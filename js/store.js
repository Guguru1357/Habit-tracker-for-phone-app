// 資料層：全部存在 localStorage，並提供匯出/匯入。
import { todayKey } from './date.js';

const STORAGE_KEY = 'habit-tracker:v1';
export const SCHEMA_VERSION = 1;

export const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b',
];

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function defaultState() {
  const t = todayKey();
  return {
    version: SCHEMA_VERSION,
    habits: [
      { id: uid(), name: '重訓', emoji: '🏋️', color: '#ef4444', freq: { type: 'weekly', times: 3, days: [] }, createdAt: t },
      { id: uid(), name: '鋼琴', emoji: '🎹', color: '#6366f1', freq: { type: 'daily', times: 1, days: [] }, createdAt: t },
      { id: uid(), name: '日文', emoji: '🗾', color: '#ec4899', freq: { type: 'daily', times: 1, days: [] }, createdAt: t },
    ],
    // done[habitId][YYYY-MM-DD] = 1
    done: {},
    settings: { theme: 'auto' },
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeHabit(h) {
  if (!h || typeof h !== 'object' || typeof h.name !== 'string') return null;
  const f = h.freq || {};
  const type = ['daily', 'weekly', 'days'].includes(f.type) ? f.type : 'daily';
  return {
    id: String(h.id || uid()),
    name: h.name.slice(0, 40),
    emoji: typeof h.emoji === 'string' && h.emoji ? h.emoji : '✅',
    color: typeof h.color === 'string' ? h.color : COLORS[5],
    freq: {
      type,
      times: Math.min(7, Math.max(1, Number(f.times) || 1)),
      days: Array.isArray(f.days) ? [...new Set(f.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : [],
    },
    createdAt: DATE_RE.test(h.createdAt) ? h.createdAt : todayKey(),
  };
}

/** 驗證並整理資料（讀取 localStorage 與匯入時共用），不合法時丟出錯誤 */
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.habits)) {
    throw new Error('格式不正確：找不到 habits 陣列');
  }
  const habits = raw.habits.map(normalizeHabit).filter(Boolean);
  const ids = new Set(habits.map((h) => h.id));
  const done = {};
  for (const [hid, days] of Object.entries(raw.done || {})) {
    if (!ids.has(hid) || !days || typeof days !== 'object') continue;
    done[hid] = {};
    for (const k of Object.keys(days)) if (DATE_RE.test(k) && days[k]) done[hid][k] = 1;
  }
  const theme = raw.settings?.theme;
  return {
    version: SCHEMA_VERSION,
    habits,
    done,
    settings: { theme: ['auto', 'light', 'dark'].includes(theme) ? theme : 'auto' },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) {
    console.warn('讀取資料失敗，使用預設值', e);
  }
  return defaultState();
}

export function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('儲存失敗', e);
    return false;
  }
}

export function exportJSON(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJSON(text) {
  return normalizeState(JSON.parse(text));
}
