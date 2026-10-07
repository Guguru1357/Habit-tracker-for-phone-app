// 日期工具：一律使用「本地時間」的 YYYY-MM-DD 字串當 key，避免時區造成跨日錯誤。

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const pad = (n) => String(n).padStart(2, '0');

export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** 0 = 週日 … 6 = 週六 */
export const weekday = (key) => fromKey(key).getDay();

/** 該週的週一（週一為一週的開始） */
export const weekStart = (key) => addDays(key, -((weekday(key) + 6) % 7));

export const monthKey = (y, m) => `${y}-${pad(m + 1)}`;

export function monthRange(y, m) {
  const first = toKey(new Date(y, m, 1));
  const last = toKey(new Date(y, m + 1, 0));
  return { first, last };
}

export function formatLong(key) {
  const d = fromKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日 週${WEEKDAY_LABELS[d.getDay()]}`;
}

export function daysBetween(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / 86400000);
}
