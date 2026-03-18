export const CATEGORIES = [
  {
    id: 'productive',
    color: '#34D399',
    emoji: '💻',
    names: { ru: 'Работа / учёба', en: 'Work / Study', zh: '工作/学习' }
  },
  {
    id: 'exercise',
    color: '#60A5FA',
    emoji: '🏋️',
    names: { ru: 'Физ. активность', en: 'Exercise', zh: '运动' }
  },
  {
    id: 'rest',
    color: '#FBBF24',
    emoji: '☕',
    names: { ru: 'Отдых', en: 'Rest', zh: '休息' }
  },
  {
    id: 'entertainment',
    color: '#F87171',
    emoji: '🎮',
    names: { ru: 'Развлечения', en: 'Entertainment', zh: '娱乐' }
  },
  {
    id: 'selfcare',
    color: '#A78BFA',
    emoji: '🍽️',
    names: { ru: 'Личный уход', en: 'Self-care', zh: '个人护理' }
  },
  {
    id: 'social',
    color: '#FB923C',
    emoji: '💬',
    names: { ru: 'Общение', en: 'Social', zh: '社交' }
  },
  {
    id: 'sleep',
    color: '#6366F1',
    emoji: '😴',
    names: { ru: 'Сон', en: 'Sleep', zh: '睡眠' }
  },
  {
    id: 'transport',
    color: '#A1887F',
    emoji: '🚗',
    names: { ru: 'Транспорт', en: 'Transport', zh: '交通' }
  },
  {
    id: 'reading',
    color: '#22D3EE',
    emoji: '📚',
    names: { ru: 'Чтение / обучение', en: 'Reading / Learning', zh: '阅读/学习' }
  },
  {
    id: 'meditation',
    color: '#F472B6',
    emoji: '🧘',
    names: { ru: 'Медитация', en: 'Meditation', zh: '冥想' }
  },
  {
    id: 'household',
    color: '#84CC16',
    emoji: '🏠',
    names: { ru: 'Быт / готовка', en: 'Household', zh: '家务' }
  }
];

export function getCategoryById(id) {
  return CATEGORIES.find(c => c.id === id) || null;
}

export function getCategoryColor(id) {
  const cat = getCategoryById(id);
  return cat ? cat.color : '#555';
}

export function getCategoryName(id, lang = 'ru') {
  const cat = getCategoryById(id);
  return cat ? (cat.names[lang] || cat.names.ru) : '—';
}
