import { CATEGORIES, getCategoryById, getCategoryName, getCategoryColor } from './categories.js';
import { t, getLang } from './i18n.js';
import {
  getAllDays, getDay, getDateStr, formatDuration,
  getCategoryStats, getBgCategoryStats, getHourlyBreakdown
} from './storage.js';

let selectedDayId = null;
let categoryChart = null;
let hourlyChart = null;

export const StatsScreen = {
  init() {},

  show() {
    if (!selectedDayId) selectedDayId = getDateStr();
    this.renderDaySelector();
    this.renderStats();
  },

  hide() {},

  renderDaySelector() {
    const container = document.getElementById('stats-day-selector');
    const days = getAllDays().sort((a, b) => b.id.localeCompare(a.id));
    const today = getDateStr();

    container.innerHTML = days.map(day => {
      const label = day.id === today ? t('days.today') : day.id;
      const isActive = day.id === selectedDayId;
      return `<button class="day-chip${isActive ? ' active' : ''}" data-day="${day.id}">${label}</button>`;
    }).join('');

    if (days.length === 0) {
      container.innerHTML = `<span style="color:var(--text-tertiary);font-size:13px">${t('days.noDay')}</span>`;
    }

    container.querySelectorAll('.day-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        selectedDayId = chip.dataset.day;
        this.renderDaySelector();
        this.renderStats();
      });
    });
  },

  renderStats() {
    const day = getDay(selectedDayId);
    const statsContent = document.getElementById('stats-content');
    const statsEmpty = document.getElementById('stats-empty');
    const summary = document.getElementById('stats-summary');

    if (!day || day.blocks.length === 0) {
      statsEmpty.style.display = '';
      document.getElementById('chart-category-card').style.display = 'none';
      document.getElementById('chart-hourly-card').style.display = 'none';
      document.getElementById('pvr-card').style.display = 'none';
      summary.style.display = 'none';
      return;
    }

    statsEmpty.style.display = 'none';
    document.getElementById('chart-category-card').style.display = '';
    document.getElementById('chart-hourly-card').style.display = '';
    summary.style.display = '';

    const catStats = getCategoryStats(day);
    const bgStats = getBgCategoryStats(day);
    const lang = getLang();

    // Summary cards
    const totalMs = Object.values(catStats).reduce((a, b) => a + b, 0);
    const totalHrs = Math.floor(totalMs / 3600000);
    const totalMin = Math.floor((totalMs % 3600000) / 60000);

    let topCatId = null;
    let topVal = 0;
    for (const [id, ms] of Object.entries(catStats)) {
      if (ms > topVal) { topVal = ms; topCatId = id; }
    }
    const topCat = getCategoryById(topCatId);

    summary.innerHTML = `
      <div class="card stat-card">
        <div class="stat-value">${totalHrs}${t('stats.hours')} ${totalMin}${t('stats.minutes')}</div>
        <div class="stat-label">${t('stats.totalTracked')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value" style="color:${topCat ? topCat.color : ''}">${topCat ? topCat.emoji : ''}</div>
        <div class="stat-label">${t('stats.topActivity')}: ${topCatId ? getCategoryName(topCatId, lang) : '—'}</div>
      </div>
    `;

    this.renderCategoryChart(catStats, lang);
    this.renderHourlyChart(day, lang);
    this.renderPlanVsReality(catStats, bgStats, lang);
  },

  renderCategoryChart(catStats, lang) {
    const canvas = document.getElementById('chart-category');
    const entries = Object.entries(catStats).sort((a, b) => b[1] - a[1]);

    if (categoryChart) categoryChart.destroy();

    const labels = entries.map(([id]) => getCategoryName(id, lang));
    const data = entries.map(([, ms]) => Math.round(ms / 60000));
    const colors = entries.map(([id]) => getCategoryColor(id));

    categoryChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 0,
          hoverBorderWidth: 2,
          hoverBorderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#8B8B9E',
              font: { family: 'Inter', size: 12 },
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 10
            }
          },
          tooltip: {
            backgroundColor: '#2A2A35',
            titleFont: { family: 'Inter' },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: ctx => `${ctx.label}: ${ctx.raw} ${t('stats.minutes')}`
            }
          }
        }
      }
    });
  },

  renderHourlyChart(day, lang) {
    const canvas = document.getElementById('chart-hourly');
    const hourly = getHourlyBreakdown(day);

    if (hourlyChart) hourlyChart.destroy();

    // Find hours with data
    const startH = day.startTime ? new Date(day.startTime).getHours() : 0;
    const endH = day.endTime ? new Date(day.endTime).getHours() : new Date().getHours();
    const hours = [];
    for (let h = startH; h <= Math.min(endH + 1, 23); h++) hours.push(h);

    // Build datasets per category (only those present)
    const presentCats = new Set();
    hours.forEach(h => {
      Object.keys(hourly[h]).forEach(c => presentCats.add(c));
    });

    const datasets = [...presentCats].map(catId => {
      const cat = getCategoryById(catId);
      return {
        label: getCategoryName(catId, lang),
        data: hours.map(h => Math.round((hourly[h][catId] || 0) / 60000)),
        backgroundColor: cat ? cat.color + 'CC' : '#555',
        borderRadius: 4,
        borderSkipped: false
      };
    });

    hourlyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: hours.map(h => `${String(h).padStart(2, '0')}:00`),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            stacked: true,
            ticks: { color: '#55556A', font: { family: 'Inter', size: 11 } },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            stacked: true,
            ticks: {
              color: '#55556A',
              font: { family: 'Inter', size: 11 },
              callback: v => `${v}m`
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#2A2A35',
            titleFont: { family: 'Inter' },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.raw} ${t('stats.minutes')}`
            }
          }
        }
      }
    });
  },

  renderPlanVsReality(catStats, bgStats, lang) {
    const pvrCard = document.getElementById('pvr-card');
    const table = document.getElementById('pvr-table');

    if (Object.keys(bgStats).length === 0) {
      pvrCard.style.display = 'none';
      return;
    }

    pvrCard.style.display = '';

    const allCats = new Set([...Object.keys(catStats), ...Object.keys(bgStats)]);
    const rows = [...allCats]
      .filter(id => bgStats[id])
      .map(id => {
        const cat = getCategoryById(id);
        const actual = catStats[id] || 0;
        const planned = bgStats[id] || 0;
        return { id, cat, actual, planned };
      })
      .sort((a, b) => b.planned - a.planned);

    table.innerHTML = `
      <thead>
        <tr>
          <th>${t('timeline.category')}</th>
          <th>${t('stats.actual')}</th>
          <th>${t('stats.planned')}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>
              <div class="pvr-cat">
                <span class="pvr-dot" style="background:${r.cat ? r.cat.color : '#555'}"></span>
                ${getCategoryName(r.id, lang)}
              </div>
            </td>
            <td>${formatDuration(r.actual)}</td>
            <td>${formatDuration(r.planned)}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
  },

  getCategoryChartBase64() {
    return categoryChart ? categoryChart.toBase64Image() : null;
  },

  getHourlyChartBase64() {
    return hourlyChart ? hourlyChart.toBase64Image() : null;
  },

  setSelectedDay(dayId) {
    selectedDayId = dayId;
  },

  updateLanguage() {
    this.renderDaySelector();
    this.renderStats();
  }
};
