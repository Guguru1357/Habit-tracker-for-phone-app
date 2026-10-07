// 統計邏輯：排程判斷、連續紀錄（streak）、月完成率。純函式，方便測試。
import { addDays, weekday, weekStart, monthRange, WEEKDAY_LABELS } from './date.js';

export const isDone = (doneMap, key) => !!doneMap?.[key];

/** 該日是否為排定要做的日子（「每週 N 次」與「每天」每天都可以做） */
export const isScheduled = (habit, key) =>
  habit.freq.type !== 'days' || habit.freq.days.includes(weekday(key));

export function weekCount(doneMap, key) {
  const start = weekStart(key);
  let n = 0;
  for (let i = 0; i < 7; i++) if (isDone(doneMap, addDays(start, i))) n++;
  return n;
}

export function freqLabel(habit) {
  const f = habit.freq;
  if (f.type === 'weekly') return `每週 ${f.times} 次`;
  if (f.type === 'days') {
    if (!f.days.length) return '未選星期';
    // 依週一到週日的順序顯示
    const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => f.days.includes(d));
    return '每週' + order.map((d) => WEEKDAY_LABELS[d]).join('、');
  }
  return '每天';
}

export const streakUnit = (habit) => (habit.freq.type === 'weekly' ? '週' : '天');

function earliestDone(doneMap) {
  let min = null;
  for (const k of Object.keys(doneMap || {})) if (!min || k < min) min = k;
  return min;
}

/**
 * 目前連續紀錄。
 * - 每天：連續完成的天數；今天還沒做不算斷（從昨天往回數）。
 * - 指定星期：連續完成的「排定日」天數，非排定日略過。
 * - 每週 N 次：連續達標的週數；本週尚未達標不算斷。
 */
export function currentStreak(habit, doneMap, today) {
  const min = earliestDone(doneMap);
  if (!min) return 0;

  if (habit.freq.type === 'weekly') {
    const t = habit.freq.times;
    let ws = weekStart(today);
    let n = 0;
    if (weekCount(doneMap, ws) >= t) n++;
    ws = addDays(ws, -7);
    while (ws >= weekStart(min) && weekCount(doneMap, ws) >= t) {
      n++;
      ws = addDays(ws, -7);
    }
    return n;
  }

  let k = today;
  if (!isDone(doneMap, k)) k = addDays(k, -1);
  let n = 0;
  while (k >= min) {
    if (isScheduled(habit, k)) {
      if (!isDone(doneMap, k)) break;
      n++;
    }
    k = addDays(k, -1);
  }
  return n;
}

/** 歷史最長連續紀錄 */
export function bestStreak(habit, doneMap, today) {
  const min = earliestDone(doneMap);
  if (!min) return 0;
  let best = 0;
  let run = 0;

  if (habit.freq.type === 'weekly') {
    for (let ws = weekStart(min); ws <= today; ws = addDays(ws, 7)) {
      run = weekCount(doneMap, ws) >= habit.freq.times ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  }

  for (let k = min; k <= today; k = addDays(k, 1)) {
    if (!isScheduled(habit, k)) continue;
    run = isDone(doneMap, k) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * 某個月的完成率。只計算「習慣開始日（或最早一筆紀錄）」到「今天」之間的日子。
 * 回傳 { done, expected, rate }；該月還沒開始時 rate 為 null。
 */
export function monthStats(habit, doneMap, year, month, today) {
  const { first, last } = monthRange(year, month);
  const earliest = earliestDone(doneMap);
  // 補登可能早於建立日，取兩者較早者為起算日
  const begin = earliest && earliest < habit.createdAt ? earliest : habit.createdAt;
  const from = begin > first ? begin : first;
  const to = last < today ? last : today;

  let done = 0;
  let expected = 0;
  let days = 0;
  for (let k = from; k <= to; k = addDays(k, 1)) {
    days++;
    const sched = isScheduled(habit, k);
    if (sched) expected++;
    if (sched && isDone(doneMap, k)) done++;
  }
  if (days === 0) return { done: 0, expected: 0, rate: null };

  if (habit.freq.type === 'weekly') {
    expected = Math.max(1, Math.round((habit.freq.times * days) / 7));
    return { done, expected, rate: Math.min(1, done / expected) };
  }
  return { done, expected, rate: expected ? done / expected : null };
}
