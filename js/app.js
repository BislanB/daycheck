import { t, getLang, setLang, getAvailableLangs } from './i18n.js';
import { getSettings, saveSettings } from './storage.js';
import { TrackerScreen } from './tracker.js';
import { TimelineScreen } from './timeline.js';
import { StatsScreen } from './stats.js';
import { showPdfDialog } from './pdf.js';

let currentTab = 'tracker';

/* ─── Modal helpers (exported for other modules) ─── */
export function openModal(innerHtml) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = innerHtml;
  overlay.classList.remove('hidden');

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  }, { once: true });
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

/* ─── Tab Navigation ─── */
function switchTab(tab) {
  if (tab === currentTab) return;

  // Hide current
  const screens = { tracker: TrackerScreen, timeline: TimelineScreen, stats: StatsScreen };
  screens[currentTab]?.hide();

  currentTab = tab;

  // Update UI
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${tab}`).classList.add('active');

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');

  // Show new screen
  screens[tab]?.show();
}

/* ─── Settings Modal ─── */
function showSettings() {
  const settings = getSettings();
  const langs = getAvailableLangs();
  const curLang = getLang();

  const langHtml = langs.map(l =>
    `<button class="lang-btn${l.code === curLang ? ' active' : ''}" data-lang="${l.code}">
      <span class="lang-flag">${l.flag}</span>
      ${l.name}
    </button>`
  ).join('');

  const html = `
    <div class="modal-handle"></div>
    <div class="modal-title">${t('settings.title')}</div>

    <div class="settings-section">
      <div class="field-label">${t('settings.language')}</div>
      <div class="lang-grid">${langHtml}</div>
    </div>

    <div class="settings-section">
      <div class="toggle-row">
        <span class="toggle-label">${t('settings.notifications')}</span>
        <button class="toggle${settings.notificationsEnabled ? ' active' : ''}" id="toggle-notif"></button>
      </div>
      <div style="margin-top:8px;display:${settings.notificationsEnabled ? '' : 'none'}" id="notif-interval-row">
        <div class="field-label">${t('settings.notifInterval')}</div>
        <select class="field-input" id="notif-interval">
          <option value="15" ${settings.notifIntervalMin === 15 ? 'selected' : ''}>15</option>
          <option value="30" ${settings.notifIntervalMin === 30 ? 'selected' : ''}>30</option>
          <option value="60" ${settings.notifIntervalMin === 60 ? 'selected' : ''}>60</option>
        </select>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn btn-primary btn-block" id="settings-close">${t('timeline.save')}</button>
    </div>
  `;

  openModal(html);

  // Language buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateAllI18n();

      // Re-open settings with new language
      setTimeout(() => showSettings(), 100);
    });
  });

  // Notification toggle
  const toggleBtn = document.getElementById('toggle-notif');
  toggleBtn.addEventListener('click', () => {
    settings.notificationsEnabled = !settings.notificationsEnabled;
    toggleBtn.classList.toggle('active', settings.notificationsEnabled);
    document.getElementById('notif-interval-row').style.display = settings.notificationsEnabled ? '' : 'none';

    if (settings.notificationsEnabled && 'Notification' in window) {
      Notification.requestPermission();
    }

    saveSettings(settings);
    setupNotifications();
  });

  // Interval
  const intervalSelect = document.getElementById('notif-interval');
  intervalSelect.addEventListener('change', () => {
    settings.notifIntervalMin = parseInt(intervalSelect.value);
    saveSettings(settings);
    setupNotifications();
  });

  // Close
  document.getElementById('settings-close').addEventListener('click', () => closeModal());
}

/* ─── i18n Update ─── */
function updateAllI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });

  TrackerScreen.updateLanguage();
  if (currentTab === 'timeline') TimelineScreen.updateLanguage();
  if (currentTab === 'stats') StatsScreen.updateLanguage();
}

/* ─── Notifications ─── */
let notifInterval = null;

function setupNotifications() {
  if (notifInterval) clearInterval(notifInterval);

  const settings = getSettings();
  if (!settings.notificationsEnabled) return;

  const ms = settings.notifIntervalMin * 60 * 1000;
  notifInterval = setInterval(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(t('notif.title'), {
        body: t('notif.reminder'),
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png'
      });
    }
  }, ms);
}

/* ─── Init ─── */
function init() {
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Settings
  document.getElementById('btn-settings').addEventListener('click', showSettings);

  // PDF Export
  document.getElementById('btn-export-pdf').addEventListener('click', () => showPdfDialog());

  // Init screens
  TrackerScreen.init();
  TimelineScreen.init();
  StatsScreen.init();

  // Show initial screen
  TrackerScreen.show();

  // Setup notifications
  setupNotifications();

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration failed:', err);
    });
  }

  // Update i18n on load
  updateAllI18n();
}

document.addEventListener('DOMContentLoaded', init);
