const STORAGE_KEY = 'daycheck_days';
const SETTINGS_KEY = 'daycheck_settings';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

/* ─── Day CRUD ─── */

export function getAllDays() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveDays(days) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
}

export function getDay(dateStr) {
  return getAllDays().find(d => d.id === dateStr) || null;
}

export function getToday() {
  return getDay(getDateStr());
}

export function saveDay(day) {
  const days = getAllDays();
  const idx = days.findIndex(d => d.id === day.id);
  if (idx >= 0) days[idx] = day;
  else days.push(day);
  saveDays(days);
}

export function deleteDay(dateStr) {
  const days = getAllDays().filter(d => d.id !== dateStr);
  saveDays(days);
}

/* ─── Day lifecycle ─── */

export function createDay() {
  const day = {
    id: getDateStr(),
    startTime: Date.now(),
    endTime: null,
    blocks: [],
    activeBlockId: null
  };
  saveDay(day);
  return day;
}

export function endDay(day) {
  if (day.activeBlockId) {
    const block = day.blocks.find(b => b.id === day.activeBlockId);
    if (block && !block.endTime) block.endTime = Date.now();
  }
  day.activeBlockId = null;
  day.endTime = Date.now();
  saveDay(day);
  return day;
}

/* ─── Block operations ─── */

export function addBlock(day, categoryId, bgCategoryId = null) {
  const now = Date.now();

  // Close previous active block
  if (day.activeBlockId) {
    const prev = day.blocks.find(b => b.id === day.activeBlockId);
    if (prev && !prev.endTime) prev.endTime = now;
  }

  const block = {
    id: genId(),
    startTime: now,
    endTime: null,
    categoryId,
    note: '',
    bgCategoryId
  };

  day.blocks.push(block);
  day.activeBlockId = block.id;
  saveDay(day);
  return block;
}

export function updateBlock(day, blockId, updates) {
  const block = day.blocks.find(b => b.id === blockId);
  if (block) {
    Object.assign(block, updates);
    saveDay(day);
  }
  return block;
}

export function deleteBlock(day, blockId) {
  day.blocks = day.blocks.filter(b => b.id !== blockId);
  if (day.activeBlockId === blockId) day.activeBlockId = null;
  saveDay(day);
}

export function getActiveBlock(day) {
  if (!day || !day.activeBlockId) return null;
  return day.blocks.find(b => b.id === day.activeBlockId) || null;
}

/* ─── Minute-level helpers ─── */

export function getMinuteArray(day) {
  if (!day || day.blocks.length === 0) return [];

  const start = day.startTime;
  const end = day.endTime || Date.now();
  const totalMinutes = Math.ceil((end - start) / 60000);
  const arr = [];

  for (let i = 0; i < totalMinutes; i++) {
    const minuteTs = start + i * 60000;
    let cat = null;
    let bg = null;

    for (const block of day.blocks) {
      const bEnd = block.endTime || Date.now();
      if (minuteTs >= block.startTime && minuteTs < bEnd) {
        cat = block.categoryId;
        bg = block.bgCategoryId;
        break;
      }
    }

    arr.push({
      minute: i,
      time: new Date(minuteTs),
      categoryId: cat,
      bgCategoryId: bg
    });
  }

  return arr;
}

export function setMinuteCategory(day, minuteIndex, categoryId) {
  const minuteTs = day.startTime + minuteIndex * 60000;
  const minuteEnd = minuteTs + 60000;

  // Find block containing this minute
  const blockIdx = day.blocks.findIndex(b => {
    const bEnd = b.endTime || Date.now();
    return minuteTs >= b.startTime && minuteTs < bEnd;
  });

  if (blockIdx < 0) {
    // No block covers this minute — create one
    day.blocks.push({
      id: genId(),
      startTime: minuteTs,
      endTime: minuteEnd,
      categoryId,
      note: '',
      bgCategoryId: null
    });
  } else {
    const block = day.blocks[blockIdx];
    if (block.categoryId === categoryId) return; // no change

    const bEnd = block.endTime || Date.now();
    const newBlocks = [];

    // Part before the minute
    if (block.startTime < minuteTs) {
      newBlocks.push({
        ...block,
        id: genId(),
        endTime: minuteTs
      });
    }

    // The minute itself
    newBlocks.push({
      id: genId(),
      startTime: minuteTs,
      endTime: minuteEnd,
      categoryId,
      note: '',
      bgCategoryId: block.bgCategoryId
    });

    // Part after the minute
    if (bEnd > minuteEnd) {
      newBlocks.push({
        ...block,
        id: block.id,
        startTime: minuteEnd
      });
    }

    // Replace original block
    day.blocks.splice(blockIdx, 1, ...newBlocks);

    // Update activeBlockId if needed
    if (day.activeBlockId === block.id) {
      const last = newBlocks[newBlocks.length - 1];
      if (!last.endTime || last.endTime > Date.now()) {
        day.activeBlockId = last.id;
      }
    }
  }

  // Merge adjacent blocks with same category
  mergeBlocks(day);
  saveDay(day);
}

function mergeBlocks(day) {
  if (day.blocks.length < 2) return;
  day.blocks.sort((a, b) => a.startTime - b.startTime);

  const merged = [day.blocks[0]];
  for (let i = 1; i < day.blocks.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = day.blocks[i];
    if (prev.categoryId === curr.categoryId &&
        prev.bgCategoryId === curr.bgCategoryId &&
        prev.endTime && Math.abs(prev.endTime - curr.startTime) < 60001) {
      prev.endTime = curr.endTime;
      prev.note = prev.note || curr.note;
      if (day.activeBlockId === curr.id) day.activeBlockId = prev.id;
    } else {
      merged.push(curr);
    }
  }
  day.blocks = merged;
}

/* ─── Manual block insertion ─── */

export function insertManualBlock(day, startTime, endTime, categoryId, note = '', bgCategoryId = null) {
  const newBlocks = [];

  for (const block of day.blocks) {
    const bStart = block.startTime;
    const bEnd = block.endTime || Date.now();

    if (bEnd <= startTime || bStart >= endTime) {
      // No overlap — keep
      newBlocks.push(block);
    } else if (bStart >= startTime && bEnd <= endTime) {
      // Block completely inside new range — remove
      if (day.activeBlockId === block.id) day.activeBlockId = null;
    } else if (bStart < startTime && bEnd > endTime) {
      // Block contains new range — split into two
      newBlocks.push({ ...block, id: genId(), endTime: startTime });
      newBlocks.push({ ...block, startTime: endTime });
    } else if (bStart < startTime) {
      // Overlap at beginning — truncate
      newBlocks.push({ ...block, endTime: startTime });
    } else {
      // Overlap at end — truncate
      newBlocks.push({ ...block, startTime: endTime });
    }
  }

  newBlocks.push({
    id: genId(),
    startTime,
    endTime,
    categoryId,
    note,
    bgCategoryId
  });

  day.blocks = newBlocks;
  day.blocks.sort((a, b) => a.startTime - b.startTime);
  mergeBlocks(day);
  saveDay(day);
}

/* ─── Statistics helpers ─── */

export function getCategoryStats(day) {
  if (!day) return {};
  const stats = {};
  for (const block of day.blocks) {
    const dur = (block.endTime || Date.now()) - block.startTime;
    stats[block.categoryId] = (stats[block.categoryId] || 0) + dur;
  }
  return stats;
}

export function getBgCategoryStats(day) {
  if (!day) return {};
  const stats = {};
  for (const block of day.blocks) {
    if (block.bgCategoryId) {
      const dur = (block.endTime || Date.now()) - block.startTime;
      stats[block.bgCategoryId] = (stats[block.bgCategoryId] || 0) + dur;
    }
  }
  return stats;
}

export function getHourlyBreakdown(day) {
  if (!day) return [];
  const hours = new Array(24).fill(null).map(() => ({}));
  for (const block of day.blocks) {
    const start = new Date(block.startTime);
    const end = new Date(block.endTime || Date.now());
    let cursor = new Date(block.startTime);

    while (cursor < end) {
      const h = cursor.getHours();
      const nextHour = new Date(cursor);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(h + 1);

      const sliceEnd = nextHour < end ? nextHour : end;
      const dur = sliceEnd - cursor;
      hours[h][block.categoryId] = (hours[h][block.categoryId] || 0) + dur;

      cursor = sliceEnd;
    }
  }
  return hours;
}

/* ─── Settings ─── */

export function getSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : {
    notificationsEnabled: false,
    notifIntervalMin: 30
  };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
