import { CATEGORIES, getCategoryById, getCategoryName } from './categories.js';
import { t, getLang } from './i18n.js';
import {
  getToday, getDay, getDateStr, createDay, endDay, addBlock,
  updateBlock, getActiveBlock, formatTime, formatDuration, saveDay
} from './storage.js';

let currentDay = null;
let timerInterval = null;
let bgSelectorOpen = false;

export const TrackerScreen = {
  init() {
    document.getElementById('btn-start-day').addEventListener('click', () => this.startDay());
    document.getElementById('btn-end-day').addEventListener('click', () => this.confirmEndDay());
    document.getElementById('bg-task-clear').addEventListener('click', () => this.clearBgTask());
    this.renderCategoryGrid();
  },

  show() {
    currentDay = getToday();
    this.render();
    this.startTimer();
  },

  hide() {
    this.stopTimer();
  },

  render() {
    const hasDay = currentDay && !currentDay.endTime;
    const activeBlock = hasDay ? getActiveBlock(currentDay) : null;

    // Day control
    document.getElementById('btn-start-day').style.display = hasDay ? 'none' : '';
    document.getElementById('btn-end-day').style.display = hasDay ? '' : 'none';
    document.getElementById('category-grid').style.display = hasDay ? '' : 'none';
    document.getElementById('mini-timeline').style.display = hasDay ? '' : 'none';

    // Activity card
    if (activeBlock) {
      const cat = getCategoryById(activeBlock.categoryId);
      document.getElementById('activity-idle').style.display = 'none';
      document.getElementById('activity-main').style.display = '';
      document.getElementById('activity-emoji').textContent = cat.emoji;
      document.getElementById('activity-name').textContent = getCategoryName(activeBlock.categoryId, getLang());
      document.getElementById('activity-name').style.color = cat.color;
      document.getElementById('pulse-dot').style.background = cat.color;
      document.getElementById('activity-card').style.borderColor = cat.color + '30';
      document.getElementById('activity-card').querySelector('::before') // CSS handles this
      this.updateTimerDisplay(activeBlock);

      // Highlight active category
      document.querySelectorAll('#category-grid .cat-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.catId === activeBlock.categoryId);
        if (btn.dataset.catId === activeBlock.categoryId) {
          btn.style.color = cat.color;
          btn.style.borderColor = cat.color;
        } else {
          btn.style.color = '';
          btn.style.borderColor = 'transparent';
        }
      });
    } else if (hasDay) {
      document.getElementById('activity-idle').style.display = '';
      document.getElementById('activity-main').style.display = 'none';
      document.getElementById('activity-card').style.borderColor = 'var(--border)';
      document.querySelectorAll('#category-grid .cat-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.color = '';
        btn.style.borderColor = 'transparent';
      });
    } else {
      document.getElementById('activity-idle').style.display = '';
      document.getElementById('activity-main').style.display = 'none';
      const idleText = document.querySelector('#activity-idle .idle-text');
      if (currentDay && currentDay.endTime) {
        idleText.textContent = t('tracker.dayEnded');
      } else {
        idleText.textContent = t('tracker.tapToStart');
      }
    }

    // Background task
    this.renderBgTask(activeBlock);

    // Mini timeline
    this.renderMiniTimeline();
  },

  renderCategoryGrid() {
    const grid = document.getElementById('category-grid');
    const bgGrid = document.getElementById('bg-category-grid');
    grid.innerHTML = '';
    bgGrid.innerHTML = '';

    CATEGORIES.forEach(cat => {
      // Main grid
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.dataset.catId = cat.id;
      btn.innerHTML = `
        <span class="cat-emoji">${cat.emoji}</span>
        <span class="cat-name">${getCategoryName(cat.id, getLang())}</span>
      `;
      btn.addEventListener('click', () => this.selectCategory(cat.id));
      grid.appendChild(btn);

      // BG grid
      const bgBtn = btn.cloneNode(true);
      bgBtn.addEventListener('click', () => this.selectBgTask(cat.id));
      bgGrid.appendChild(bgBtn);
    });

    // BG task toggle button
    const bgToggle = document.createElement('button');
    bgToggle.className = 'btn btn-sm btn-secondary btn-block';
    bgToggle.style.marginTop = '12px';
    bgToggle.id = 'btn-bg-toggle';
    bgToggle.innerHTML = `<span data-i18n="tracker.bgTask">${t('tracker.bgTask')}</span>`;
    bgToggle.addEventListener('click', () => this.toggleBgSelector());

    // Insert after category grid
    const existingToggle = document.getElementById('btn-bg-toggle');
    if (existingToggle) existingToggle.remove();
    document.getElementById('category-grid').after(bgToggle);
  },

  selectCategory(catId) {
    if (!currentDay || currentDay.endTime) return;

    const activeBlock = getActiveBlock(currentDay);
    const currentBg = activeBlock ? activeBlock.bgCategoryId : null;

    addBlock(currentDay, catId, currentBg);
    currentDay = getToday();
    this.render();
  },

  toggleBgSelector() {
    bgSelectorOpen = !bgSelectorOpen;
    document.getElementById('bg-selector').style.display = bgSelectorOpen ? '' : 'none';
  },

  selectBgTask(catId) {
    if (!currentDay) return;
    const activeBlock = getActiveBlock(currentDay);
    if (activeBlock) {
      updateBlock(currentDay, activeBlock.id, { bgCategoryId: catId });
      currentDay = getToday();
    }
    bgSelectorOpen = false;
    document.getElementById('bg-selector').style.display = 'none';
    this.render();
  },

  clearBgTask() {
    if (!currentDay) return;
    const activeBlock = getActiveBlock(currentDay);
    if (activeBlock) {
      updateBlock(currentDay, activeBlock.id, { bgCategoryId: null });
      currentDay = getToday();
    }
    this.render();
  },

  renderBgTask(activeBlock) {
    const card = document.getElementById('bg-task-card');
    if (activeBlock && activeBlock.bgCategoryId) {
      const bgCat = getCategoryById(activeBlock.bgCategoryId);
      card.style.display = '';
      card.style.borderColor = bgCat.color + '20';
      document.getElementById('bg-task-emoji').textContent = bgCat.emoji;
      document.getElementById('bg-task-name').textContent = getCategoryName(activeBlock.bgCategoryId, getLang());
      document.getElementById('bg-task-name').style.color = bgCat.color;
    } else {
      card.style.display = 'none';
    }
  },

  renderMiniTimeline() {
    const container = document.getElementById('mini-timeline');
    if (!currentDay || currentDay.blocks.length === 0) {
      container.innerHTML = '';
      return;
    }

    const totalDur = (currentDay.endTime || Date.now()) - currentDay.startTime;
    if (totalDur <= 0) return;

    container.innerHTML = currentDay.blocks.map(block => {
      const dur = (block.endTime || Date.now()) - block.startTime;
      const pct = Math.max(0.5, (dur / totalDur) * 100);
      const cat = getCategoryById(block.categoryId);
      return `<div class="mini-timeline-block" style="width:${pct}%;background:${cat ? cat.color : '#555'}"></div>`;
    }).join('');
  },

  startDay() {
    currentDay = createDay();
    this.render();
  },

  confirmEndDay() {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    backdrop.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-text">${t('tracker.confirmEnd')}</div>
        <div class="confirm-actions">
          <button class="btn btn-secondary" id="confirm-no">${t('confirm.no')}</button>
          <button class="btn btn-danger" id="confirm-yes">${t('confirm.yes')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.querySelector('#confirm-no').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('#confirm-yes').addEventListener('click', () => {
      endDay(currentDay);
      currentDay = getToday();
      this.render();
      backdrop.remove();
    });
  },

  startTimer() {
    this.stopTimer();
    timerInterval = setInterval(() => {
      currentDay = getToday();
      const activeBlock = getActiveBlock(currentDay);
      if (activeBlock) {
        this.updateTimerDisplay(activeBlock);
        this.renderMiniTimeline();
      }
    }, 1000);
  },

  stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  },

  updateTimerDisplay(block) {
    const elapsed = Date.now() - block.startTime;
    const sec = Math.floor(elapsed / 1000) % 60;
    const min = Math.floor(elapsed / 60000) % 60;
    const hr = Math.floor(elapsed / 3600000);
    const display = hr > 0
      ? `${hr}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
      : `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    document.getElementById('timer-display').textContent = display;
  },

  updateLanguage() {
    this.renderCategoryGrid();
    this.render();
  }
};
