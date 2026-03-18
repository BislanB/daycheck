import { CATEGORIES, getCategoryById, getCategoryName, getCategoryColor } from './categories.js';
import { t, getLang } from './i18n.js';
import {
  getAllDays, getDay, getDateStr, formatTime, formatDuration,
  getMinuteArray, setMinuteCategory, updateBlock, deleteBlock, saveDay,
  insertManualBlock
} from './storage.js';
import { openModal, closeModal } from './app.js';

let selectedDayId = null;
let minuteMode = false;
let selectedMinuteCat = null;

function tsToTimeStr(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function timeStrToTs(dayStartTs, timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dayStartTs);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export const TimelineScreen = {
  init() {
    document.getElementById('btn-minute-mode').addEventListener('click', () => this.toggleMinuteMode());
    document.getElementById('btn-minute-back').addEventListener('click', () => this.toggleMinuteMode());
  },

  show() {
    if (!selectedDayId) selectedDayId = getDateStr();
    this.renderDaySelector();
    this.renderTimeline();
  },

  hide() {},

  renderDaySelector() {
    const container = document.getElementById('timeline-day-selector');
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
        this.renderTimeline();
      });
    });
  },

  renderTimeline() {
    const day = getDay(selectedDayId);
    const list = document.getElementById('timeline-list');
    const gridContainer = document.getElementById('minute-grid-container');
    const listContainer = document.getElementById('timeline-list-container');

    if (minuteMode) {
      listContainer.style.display = 'none';
      gridContainer.classList.add('active');
      this.renderMinuteGrid(day);
      return;
    }

    listContainer.style.display = '';
    gridContainer.classList.remove('active');

    // Add entry button + minute mode button at top
    let topActions = `<div class="timeline-actions-bar">
      <button class="btn btn-sm btn-primary" id="btn-add-entry" style="flex:1;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        ${t('timeline.addEntry')}
      </button>
      <button class="btn btn-sm btn-secondary" id="btn-minute-mode-alt">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        ${t('timeline.minuteEntry')}
      </button>
    </div>`;

    if (!day || day.blocks.length === 0) {
      list.innerHTML = topActions + `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">${t('timeline.empty')}</div>
        </div>`;
      this.bindTopActions();
      return;
    }

    const lang = getLang();
    const sorted = [...day.blocks].sort((a, b) => a.startTime - b.startTime);

    list.innerHTML = topActions + sorted.map(block => {
      const cat = getCategoryById(block.categoryId);
      const dur = (block.endTime || Date.now()) - block.startTime;
      const endStr = block.endTime ? formatTime(block.endTime) : '...';
      const bgHtml = block.bgCategoryId
        ? `<div class="timeline-bg-indicator">
             <span class="timeline-bg-dot" style="background:${getCategoryColor(block.bgCategoryId)}"></span>
             ${getCategoryName(block.bgCategoryId, lang)}
           </div>`
        : '';
      const noteHtml = block.note
        ? `<div class="timeline-note-preview">📝 ${block.note}</div>`
        : '';

      return `
        <div class="timeline-block" data-block-id="${block.id}">
          <div class="timeline-color" style="background:${cat ? cat.color : '#555'}"></div>
          <div class="timeline-content">
            <div class="timeline-time">${formatTime(block.startTime)} — ${endStr}</div>
            <div class="timeline-cat-name" style="color:${cat ? cat.color : '#fff'}">
              ${cat ? cat.emoji : ''} ${getCategoryName(block.categoryId, lang)}
            </div>
            ${noteHtml}
            ${bgHtml}
            <div class="timeline-duration">${formatDuration(dur)}</div>
          </div>
        </div>`;
    }).join('');

    this.bindTopActions();

    list.querySelectorAll('.timeline-block').forEach(el => {
      el.addEventListener('click', () => this.editBlock(el.dataset.blockId));
    });
  },

  bindTopActions() {
    const addBtn = document.getElementById('btn-add-entry');
    if (addBtn) addBtn.addEventListener('click', () => this.addManualEntry());
    const mmBtn = document.getElementById('btn-minute-mode-alt');
    if (mmBtn) mmBtn.addEventListener('click', () => this.toggleMinuteMode());
  },

  /* ─── Add Manual Entry ─── */
  addManualEntry() {
    const day = getDay(selectedDayId);
    if (!day) return;

    const lang = getLang();
    const now = new Date();
    const defaultStart = tsToTimeStr(now.getTime() - 30 * 60000);
    const defaultEnd = tsToTimeStr(now.getTime());

    const catGridHtml = CATEGORIES.map((cat, i) => {
      const isFirst = i === 0;
      return `<button class="cat-select-btn${isFirst ? ' active' : ''}" data-cat="${cat.id}" style="${isFirst ? 'color:' + cat.color : ''}">
        <span class="cat-emoji">${cat.emoji}</span>
        <span class="cat-name">${getCategoryName(cat.id, lang)}</span>
      </button>`;
    }).join('');

    const bgGridHtml = `<button class="cat-select-btn active" data-bg="none" style="color:#60A5FA">
      <span class="cat-emoji">✕</span>
      <span class="cat-name">${t('tracker.bgTaskNone')}</span>
    </button>` + CATEGORIES.map(cat =>
      `<button class="cat-select-btn" data-bg="${cat.id}">
        <span class="cat-emoji">${cat.emoji}</span>
        <span class="cat-name">${getCategoryName(cat.id, lang)}</span>
      </button>`
    ).join('');

    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">${t('timeline.addEntry')}</div>

      <div class="field">
        <div class="field-label">${t('timeline.from')}</div>
        <input type="time" class="field-input" id="add-start-time" value="${defaultStart}">
      </div>
      <div class="field">
        <div class="field-label">${t('timeline.to')}</div>
        <input type="time" class="field-input" id="add-end-time" value="${defaultEnd}">
      </div>

      <div class="field">
        <div class="field-label">${t('timeline.category')}</div>
        <div class="cat-select-grid" id="add-cat-grid">${catGridHtml}</div>
      </div>

      <div class="field">
        <div class="field-label">${t('timeline.note')}</div>
        <textarea class="field-input" id="add-note" placeholder="${t('timeline.notePlaceholder')}"></textarea>
      </div>

      <div class="field">
        <div class="field-label">${t('timeline.bgTask')}</div>
        <div class="cat-select-grid" id="add-bg-grid">${bgGridHtml}</div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" id="add-cancel">${t('timeline.cancel')}</button>
        <button class="btn btn-primary" id="add-save">${t('timeline.save')}</button>
      </div>
    `;

    openModal(html);

    let selCat = CATEGORIES[0].id;
    let selBg = null;

    // Category selection
    document.querySelectorAll('#add-cat-grid .cat-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selCat = btn.dataset.cat;
        document.querySelectorAll('#add-cat-grid .cat-select-btn').forEach(b => {
          b.classList.remove('active'); b.style.color = '';
        });
        btn.classList.add('active');
        const c = getCategoryById(selCat);
        btn.style.color = c ? c.color : '';
      });
    });

    // BG selection
    document.querySelectorAll('#add-bg-grid .cat-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selBg = btn.dataset.bg === 'none' ? null : btn.dataset.bg;
        document.querySelectorAll('#add-bg-grid .cat-select-btn').forEach(b => {
          b.classList.remove('active'); b.style.color = '';
        });
        btn.classList.add('active');
        if (selBg) {
          const c = getCategoryById(selBg);
          btn.style.color = c ? c.color : '';
        } else {
          btn.style.color = '#60A5FA';
        }
      });
    });

    document.getElementById('add-cancel').addEventListener('click', () => closeModal());
    document.getElementById('add-save').addEventListener('click', () => {
      const startStr = document.getElementById('add-start-time').value;
      const endStr = document.getElementById('add-end-time').value;
      const note = document.getElementById('add-note').value.trim();

      if (!startStr || !endStr) return;

      const freshDay = getDay(selectedDayId);
      const startTs = timeStrToTs(freshDay.startTime, startStr);
      const endTs = timeStrToTs(freshDay.startTime, endStr);

      if (endTs <= startTs) return;

      insertManualBlock(freshDay, startTs, endTs, selCat, note, selBg);
      closeModal();
      this.renderTimeline();
    });
  },

  /* ─── Edit Block ─── */
  editBlock(blockId) {
    const day = getDay(selectedDayId);
    if (!day) return;
    const block = day.blocks.find(b => b.id === blockId);
    if (!block) return;

    const lang = getLang();
    const startTimeStr = tsToTimeStr(block.startTime);
    const endTimeStr = block.endTime ? tsToTimeStr(block.endTime) : tsToTimeStr(Date.now());

    const catGridHtml = CATEGORIES.map(cat => {
      const isActive = cat.id === block.categoryId;
      return `<button class="cat-select-btn${isActive ? ' active' : ''}" data-cat="${cat.id}" style="${isActive ? 'color:' + cat.color : ''}">
        <span class="cat-emoji">${cat.emoji}</span>
        <span class="cat-name">${getCategoryName(cat.id, lang)}</span>
      </button>`;
    }).join('');

    const bgGridHtml = `<button class="cat-select-btn${!block.bgCategoryId ? ' active' : ''}" data-bg="none" style="${!block.bgCategoryId ? 'color:#60A5FA' : ''}">
      <span class="cat-emoji">✕</span>
      <span class="cat-name">${t('tracker.bgTaskNone')}</span>
    </button>` + CATEGORIES.map(cat => {
      const isActive = cat.id === block.bgCategoryId;
      return `<button class="cat-select-btn${isActive ? ' active' : ''}" data-bg="${cat.id}" style="${isActive ? 'color:' + cat.color : ''}">
        <span class="cat-emoji">${cat.emoji}</span>
        <span class="cat-name">${getCategoryName(cat.id, lang)}</span>
      </button>`;
    }).join('');

    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">${t('timeline.editBlock')}</div>

      <div style="display:flex;gap:10px;">
        <div class="field" style="flex:1;">
          <div class="field-label">${t('timeline.from')}</div>
          <input type="time" class="field-input" id="edit-start-time" value="${startTimeStr}">
        </div>
        <div class="field" style="flex:1;">
          <div class="field-label">${t('timeline.to')}</div>
          <input type="time" class="field-input" id="edit-end-time" value="${endTimeStr}">
        </div>
      </div>

      <div class="field">
        <div class="field-label">${t('timeline.category')}</div>
        <div class="cat-select-grid" id="edit-cat-grid">${catGridHtml}</div>
      </div>

      <div class="field">
        <div class="field-label">${t('timeline.note')}</div>
        <textarea class="field-input" id="edit-note" placeholder="${t('timeline.notePlaceholder')}">${block.note || ''}</textarea>
      </div>

      <div class="field">
        <div class="field-label">${t('timeline.bgTask')}</div>
        <div class="cat-select-grid" id="edit-bg-grid">${bgGridHtml}</div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-danger btn-sm" id="edit-delete">${t('timeline.delete')}</button>
        <button class="btn btn-secondary" id="edit-cancel">${t('timeline.cancel')}</button>
        <button class="btn btn-primary" id="edit-save">${t('timeline.save')}</button>
      </div>
    `;

    openModal(html);

    let editCat = block.categoryId;
    let editBg = block.bgCategoryId;

    // Category selection
    document.querySelectorAll('#edit-cat-grid .cat-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        editCat = btn.dataset.cat;
        document.querySelectorAll('#edit-cat-grid .cat-select-btn').forEach(b => {
          b.classList.remove('active'); b.style.color = '';
        });
        btn.classList.add('active');
        const c = getCategoryById(editCat);
        btn.style.color = c ? c.color : '';
      });
    });

    // BG selection
    document.querySelectorAll('#edit-bg-grid .cat-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        editBg = btn.dataset.bg === 'none' ? null : btn.dataset.bg;
        document.querySelectorAll('#edit-bg-grid .cat-select-btn').forEach(b => {
          b.classList.remove('active'); b.style.color = '';
        });
        btn.classList.add('active');
        if (editBg) {
          const c = getCategoryById(editBg);
          btn.style.color = c ? c.color : '';
        } else {
          btn.style.color = '#60A5FA';
        }
      });
    });

    document.getElementById('edit-save').addEventListener('click', () => {
      const note = document.getElementById('edit-note').value.trim();
      const newStartStr = document.getElementById('edit-start-time').value;
      const newEndStr = document.getElementById('edit-end-time').value;

      const freshDay = getDay(selectedDayId);

      // Update time if changed
      const newStartTs = timeStrToTs(freshDay.startTime, newStartStr);
      const newEndTs = timeStrToTs(freshDay.startTime, newEndStr);

      updateBlock(freshDay, blockId, {
        categoryId: editCat,
        note,
        bgCategoryId: editBg,
        startTime: newStartTs,
        endTime: newEndTs > newStartTs ? newEndTs : null
      });
      closeModal();
      this.renderTimeline();
    });

    document.getElementById('edit-cancel').addEventListener('click', () => closeModal());

    document.getElementById('edit-delete').addEventListener('click', () => {
      const freshDay = getDay(selectedDayId);
      deleteBlock(freshDay, blockId);
      closeModal();
      this.renderTimeline();
    });
  },

  /* ─── Minute Mode ─── */
  toggleMinuteMode() {
    minuteMode = !minuteMode;
    this.renderTimeline();
  },

  renderMinuteGrid(day) {
    const grid = document.getElementById('minute-grid');
    const selectorBar = document.getElementById('minute-selector-bar');

    if (!day || day.blocks.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-text">${t('timeline.empty')}</div></div>`;
      selectorBar.innerHTML = '';
      return;
    }

    const minutes = getMinuteArray(day);
    const lang = getLang();
    let html = '';
    let lastHour = -1;

    minutes.forEach((m, i) => {
      const hour = m.time.getHours();
      if (hour !== lastHour) {
        lastHour = hour;
        html += `<div class="minute-hour-label">${String(hour).padStart(2, '0')}:00</div>`;
      }
      const color = m.categoryId ? getCategoryColor(m.categoryId) : 'rgba(255,255,255,0.03)';
      const title = `${String(m.time.getHours()).padStart(2,'0')}:${String(m.time.getMinutes()).padStart(2,'0')} — ${m.categoryId ? getCategoryName(m.categoryId, lang) : '—'}`;
      html += `<div class="minute-cell" data-minute="${i}" style="background:${color}" title="${title}"></div>`;
    });

    grid.innerHTML = html;

    // Selector bar
    if (!selectedMinuteCat) selectedMinuteCat = CATEGORIES[0].id;

    selectorBar.innerHTML = CATEGORIES.map(cat => {
      const isActive = cat.id === selectedMinuteCat;
      return `<button class="minute-cat-btn${isActive ? ' active' : ''}" data-cat="${cat.id}" style="${isActive ? 'color:' + cat.color : ''}">
        <span class="minute-cat-dot" style="background:${cat.color}"></span>
        ${getCategoryName(cat.id, lang)}
      </button>`;
    }).join('');

    // Events
    selectorBar.querySelectorAll('.minute-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMinuteCat = btn.dataset.cat;
        selectorBar.querySelectorAll('.minute-cat-btn').forEach(b => {
          b.classList.remove('active'); b.style.color = '';
        });
        btn.classList.add('active');
        const c = getCategoryById(selectedMinuteCat);
        btn.style.color = c ? c.color : '';
      });
    });

    grid.querySelectorAll('.minute-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        if (!selectedMinuteCat) return;
        const idx = parseInt(cell.dataset.minute);
        const freshDay = getDay(selectedDayId);
        setMinuteCategory(freshDay, idx, selectedMinuteCat);
        this.renderMinuteGrid(getDay(selectedDayId));
      });
    });
  },

  setSelectedDay(dayId) {
    selectedDayId = dayId;
  },

  updateLanguage() {
    this.renderDaySelector();
    this.renderTimeline();
  }
};
