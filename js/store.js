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
      { id: uid(), name: '重訓', emoji: '🏋️', color: '#ef4444', freq: { type: 'weekly', times: 3, days: [] }, log: 'workout', createdAt: t },
      { id: uid(), name: '鋼琴', emoji: '🎹', color: '#6366f1', freq: { type: 'daily', times: 1, days: [] }, log: 'none', createdAt: t },
      { id: uid(), name: '日文', emoji: '🗾', color: '#ec4899', freq: { type: 'daily', times: 1, days: [] }, log: 'none', createdAt: t },
    ],
    // done[habitId][YYYY-MM-DD] = 1
    done: {},
    // workouts[habitId][YYYY-MM-DD] = [{ id, part, machine, weight, sets, reps }]
    workouts: {},
    settings: { theme: 'auto', weightUnit: 'kg' },
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
    // 舊資料沒有 log 欄位時，名稱含「重訓／健身」的習慣自動開啟訓練紀錄
    log: h.log === 'workout' || (h.log === undefined && /重訓|健身/.test(h.name)) ? 'workout' : 'none',
    createdAt: DATE_RE.test(h.createdAt) ? h.createdAt : todayKey(),
  };
}

const num = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
};

export function normalizeExercise(e) {
  if (!e || typeof e !== 'object') return null;
  const part = String(e.part || '').trim().slice(0, 20);
  const machine = String(e.machine || '').trim().slice(0, 40);
  if (!part && !machine) return null;
  return {
    id: String(e.id || uid()),
    part,
    machine,
    weight: num(e.weight, 9999),
    unit: e.unit === 'lb' ? 'lb' : 'kg',
    sets: num(e.sets, 99) && Math.round(num(e.sets, 99)),
    reps: num(e.reps, 999) && Math.round(num(e.reps, 999)),
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
  const workouts = {};
  for (const [hid, days] of Object.entries(raw.workouts || {})) {
    if (!ids.has(hid) || !days || typeof days !== 'object') continue;
    for (const [k, list] of Object.entries(days)) {
      if (!DATE_RE.test(k) || !Array.isArray(list)) continue;
      const clean = list.map(normalizeExercise).filter(Boolean);
      if (clean.length) (workouts[hid] ||= {})[k] = clean;
    }
  }
  const theme = raw.settings?.theme;
  return {
    version: SCHEMA_VERSION,
    habits,
    done,
    workouts,
    settings: {
      theme: ['auto', 'light', 'dark'].includes(theme) ? theme : 'auto',
      weightUnit: raw.settings?.weightUnit === 'lb' ? 'lb' : 'kg',
    },
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
