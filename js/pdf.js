import { CATEGORIES, getCategoryById, getCategoryName, getCategoryColor } from './categories.js';
import { t, getLang } from './i18n.js';
import {
  getDay, getDateStr, formatTime, formatDuration,
  getCategoryStats, getBgCategoryStats, getMinuteArray
} from './storage.js';
import { openModal, closeModal } from './app.js';
import { StatsScreen } from './stats.js';

export function showPdfDialog(dayId) {
  const id = dayId || getDateStr();
  let includeMinuteLog = false;

  const html = `
    <div class="modal-handle"></div>
    <div class="modal-title">${t('pdf.title')}</div>

    <div class="pdf-option active" id="pdf-opt-stats" data-mode="stats">
      <div class="pdf-radio"></div>
      <div class="pdf-option-text">${t('pdf.statsOnly')}</div>
    </div>
    <div class="pdf-option" id="pdf-opt-minute" data-mode="minute">
      <div class="pdf-radio"></div>
      <div class="pdf-option-text">${t('pdf.withMinuteLog')}</div>
    </div>

    <div class="modal-actions">
      <button class="btn btn-secondary" id="pdf-cancel">${t('pdf.cancel')}</button>
      <button class="btn btn-primary" id="pdf-export">${t('pdf.export')}</button>
    </div>
  `;

  openModal(html);

  const optStats = document.getElementById('pdf-opt-stats');
  const optMinute = document.getElementById('pdf-opt-minute');

  function selectOpt(mode) {
    includeMinuteLog = mode === 'minute';
    optStats.classList.toggle('active', mode === 'stats');
    optMinute.classList.toggle('active', mode === 'minute');
  }

  optStats.addEventListener('click', () => selectOpt('stats'));
  optMinute.addEventListener('click', () => selectOpt('minute'));

  document.getElementById('pdf-cancel').addEventListener('click', () => closeModal());
  document.getElementById('pdf-export').addEventListener('click', () => {
    closeModal();
    generatePdf(id, includeMinuteLog);
  });
}

async function generatePdf(dayId, includeMinuteLog) {
  const day = getDay(dayId);
  if (!day) return;

  const lang = getLang();
  const catStats = getCategoryStats(day);
  const bgStats = getBgCategoryStats(day);
  const totalMs = Object.values(catStats).reduce((a, b) => a + b, 0);

  // Get chart images
  const catChartImg = StatsScreen.getCategoryChartBase64();
  const hourlyChartImg = StatsScreen.getHourlyChartBase64();

  // Build styled HTML for PDF rendering
  const s = `font-family:'Inter',Arial,sans-serif;`;
  let html = `<div style="${s}background:#0F0F13;color:#F1F1F3;padding:32px;min-height:100%;">`;

  // Title
  html += `<h1 style="font-size:26px;font-weight:700;margin:0 0 6px;">DayCheck Report</h1>`;
  html += `<p style="color:#8B8B9E;font-size:14px;margin:0 0 2px;">${dayId}</p>`;
  html += `<p style="color:#55556A;font-size:12px;margin:0 0 24px;">${formatTime(day.startTime)} — ${day.endTime ? formatTime(day.endTime) : '...'}</p>`;

  // Summary
  html += `<div style="display:flex;gap:12px;margin-bottom:24px;">`;
  html += `<div style="flex:1;background:rgba(255,255,255,0.04);border-radius:14px;padding:16px;">
    <div style="font-size:24px;font-weight:700;">${formatDuration(totalMs)}</div>
    <div style="font-size:11px;color:#55556A;margin-top:4px;">${t('stats.totalTracked')}</div>
  </div>`;

  let topCatId = null, topVal = 0;
  for (const [id, ms] of Object.entries(catStats)) {
    if (ms > topVal) { topVal = ms; topCatId = id; }
  }
  const topCat = getCategoryById(topCatId);
  html += `<div style="flex:1;background:rgba(255,255,255,0.04);border-radius:14px;padding:16px;">
    <div style="font-size:24px;">${topCat ? topCat.emoji : '—'}</div>
    <div style="font-size:11px;color:#55556A;margin-top:4px;">${t('stats.topActivity')}: ${topCatId ? getCategoryName(topCatId, lang) : '—'}</div>
  </div>`;
  html += `</div>`;

  // Category breakdown
  html += `<h3 style="font-size:13px;color:#55556A;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 12px;">${t('stats.byCategory')}</h3>`;
  const sortedCats = Object.entries(catStats).sort((a, b) => b[1] - a[1]);
  sortedCats.forEach(([catId, ms]) => {
    const cat = getCategoryById(catId);
    const pct = totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0;
    html += `<div style="display:flex;align-items:center;gap:10px;margin:8px 0;font-size:14px;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${cat ? cat.color : '#555'};flex-shrink:0;"></span>
      <span style="flex:1;">${getCategoryName(catId, lang)}</span>
      <span style="color:#8B8B9E;">${formatDuration(ms)} (${pct}%)</span>
    </div>`;
  });

  // Charts
  if (catChartImg) {
    html += `<div style="margin-top:24px;text-align:center;"><img src="${catChartImg}" style="width:100%;max-width:380px;border-radius:14px;"></div>`;
  }
  if (hourlyChartImg) {
    html += `<div style="margin-top:16px;text-align:center;"><img src="${hourlyChartImg}" style="width:100%;max-width:380px;border-radius:14px;"></div>`;
  }

  // Plan vs Reality
  if (Object.keys(bgStats).length > 0) {
    html += `<h3 style="font-size:13px;color:#55556A;text-transform:uppercase;letter-spacing:0.8px;margin:24px 0 12px;">${t('stats.planVsReality')}</h3>`;
    const bgCats = Object.keys(bgStats);
    bgCats.forEach(catId => {
      const cat = getCategoryById(catId);
      const actual = catStats[catId] || 0;
      const planned = bgStats[catId];
      html += `<div style="display:flex;align-items:center;gap:8px;margin:6px 0;font-size:13px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${cat ? cat.color : '#555'};"></span>
        <span style="flex:1;">${getCategoryName(catId, lang)}</span>
        <span style="color:#8B8B9E;">${formatDuration(actual)}</span>
        <span style="color:#55556A;">/</span>
        <span style="color:#55556A;">${formatDuration(planned)}</span>
      </div>`;
    });
  }

  // Timeline blocks
  if (includeMinuteLog) {
    html += `<div style="page-break-before:always;"></div>`;
    html += `<h3 style="font-size:13px;color:#55556A;text-transform:uppercase;letter-spacing:0.8px;margin:24px 0 12px;">${t('timeline.title')}</h3>`;

    const sorted = [...day.blocks].sort((a, b) => a.startTime - b.startTime);
    sorted.forEach(block => {
      const cat = getCategoryById(block.categoryId);
      const dur = formatDuration((block.endTime || Date.now()) - block.startTime);
      const endStr = block.endTime ? formatTime(block.endTime) : '...';

      html += `<div style="display:flex;gap:10px;margin:6px 0;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:10px;">
        <div style="width:3px;border-radius:2px;background:${cat ? cat.color : '#555'};flex-shrink:0;"></div>
        <div style="flex:1;">
          <div style="font-size:11px;color:#55556A;">${formatTime(block.startTime)} — ${endStr}</div>
          <div style="font-size:14px;color:${cat ? cat.color : '#fff'};margin-top:2px;">${cat ? cat.emoji : ''} ${getCategoryName(block.categoryId, lang)} <span style="color:#8B8B9E;font-size:12px;">(${dur})</span></div>
          ${block.note ? `<div style="font-size:11px;color:#8B8B9E;margin-top:3px;">📝 ${block.note}</div>` : ''}
          ${block.bgCategoryId ? `<div style="font-size:11px;color:#55556A;margin-top:2px;">🔄 ${getCategoryName(block.bgCategoryId, lang)}</div>` : ''}
        </div>
      </div>`;
    });

    // Minute grid visualization
    html += `<h3 style="font-size:13px;color:#55556A;text-transform:uppercase;letter-spacing:0.8px;margin:20px 0 10px;">${t('timeline.minuteMode')}</h3>`;
    const minutes = getMinuteArray(day);
    let lastHour = -1;

    minutes.forEach(m => {
      const hour = m.time.getHours();
      if (hour !== lastHour) {
        if (lastHour !== -1) html += `</div>`;
        lastHour = hour;
        html += `<div style="margin-top:6px;"><span style="font-size:10px;color:#55556A;display:block;margin-bottom:3px;">${String(hour).padStart(2, '0')}:00</span><div style="display:flex;flex-wrap:wrap;gap:1px;">`;
      }
      const color = m.categoryId ? getCategoryColor(m.categoryId) : 'rgba(255,255,255,0.06)';
      html += `<div style="width:8px;height:8px;border-radius:2px;background:${color};" title="${String(m.time.getHours()).padStart(2,'0')}:${String(m.time.getMinutes()).padStart(2,'0')}"></div>`;
    });
    if (lastHour !== -1) html += `</div></div>`;
  }

  html += `</div>`;

  // Create temp container for html2pdf
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.width = '210mm';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    await window.html2pdf().set({
      margin: 0,
      filename: `DayCheck_${dayId}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, backgroundColor: '#0F0F13', useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(container).save();
  } catch (e) {
    console.error('PDF generation failed:', e);
  } finally {
    container.remove();
  }
}
