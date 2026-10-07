import {
  todayKey, addDays, formatLong, weekday, weekStart, fromKey, monthRange, WEEKDAY_LABELS,
} from './date.js';
import {
  load, save, uid, COLORS, exportJSON, importJSON, defaultState, normalizeExercise,
} from './store.js';
import {
  isDone, isScheduled, weekCount, freqLabel, currentStreak, bestStreak, monthStats, streakUnit,
} from './stats.js';

const EMOJIS = ['🏋️', '🎹', '🗾', '💊', '🧹', '📚', '🏃', '💧', '🧘', '✍️', '🎸', '😴', '🥗', '🚶', '🧠', '🎨', '🦷', '🌱'];

let state = load();
const ui = {
  view: 'today',
  date: todayKey(), // 今日頁目前顯示的日期（可往回補登）
  followToday: true, // 是否自動跟著「今天」跨日
  statsMonth: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })(),
};

const $ = (sel, root = document) => root.querySelector(sel);
const main = $('#main');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function commit() {
  if (!save(state)) toast('⚠️ 儲存失敗，儲存空間可能已滿');
  render();
}

function toggle(habitId, key) {
  const map = (state.done[habitId] ||= {});
  if (map[key]) delete map[key];
  else map[key] = 1;
  navigator.vibrate?.(8);
  commit();
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- 主題 ----------
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]').content = dark ? '#111318' : '#f6f7f9';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------- 今日頁 ----------
function habitCard(h, key, today) {
  const map = state.done[h.id];
  const done = isDone(map, key);
  let sub = freqLabel(h);
  if (h.freq.type === 'weekly') sub = `本週 ${weekCount(map, key)}/${h.freq.times} 次`;
  const streak = currentStreak(h, map, today);
  const card = `
    <button class="habit ${done ? 'done' : ''}" style="--c:${esc(h.color)}" data-toggle="${esc(h.id)}" aria-pressed="${done}">
      <span class="emoji">${esc(h.emoji)}</span>
      <span class="info">
        <span class="name">${esc(h.name)}</span>
        <span class="sub">${esc(sub)}${streak ? ` · 🔥 ${streak} ${streakUnit(h)}` : ''}</span>
      </span>
      <span class="check" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      </span>
    </button>`;
  if (h.log !== 'workout') return card;
  const list = state.workouts[h.id]?.[key] || [];
  const parts = [...new Set(list.map((e) => e.part).filter(Boolean))].join('、');
  return `
    <div class="habit-group" style="--c:${esc(h.color)}">
      ${card}
      <button class="log-btn" data-log="${esc(h.id)}">
        ${list.length ? `📋 ${list.length} 個動作${parts ? `（${esc(parts)}）` : ''}` : '＋ 記錄訓練內容'}
        <span aria-hidden="true">›</span>
      </button>
    </div>`;
}

function renderToday() {
  const today = todayKey();
  const key = ui.date;
  const isToday = key === today;
  const scheduled = state.habits.filter((h) => isScheduled(h, key));
  const rest = state.habits.filter((h) => !isScheduled(h, key));
  const doneCount = scheduled.filter((h) => isDone(state.done[h.id], key)).length;
  const pct = scheduled.length ? Math.round((doneCount / scheduled.length) * 100) : 0;

  main.innerHTML = `
    <header class="day-nav">
      <button class="icon-btn" data-day="-1" aria-label="前一天">‹</button>
      <div class="day-title">
        <h1>${isToday ? '今天' : formatLong(key)}</h1>
        <p>${isToday ? formatLong(key) : `<button class="link" data-day="today">回到今天</button>`}</p>
      </div>
      <button class="icon-btn" data-day="1" aria-label="後一天" ${isToday ? 'disabled' : ''}>›</button>
    </header>
    ${!isToday ? `<div class="banner">📝 補登模式：正在編輯 ${formatLong(key)} 的紀錄</div>` : ''}
    ${state.habits.length ? `
      <div class="progress">
        <div class="bar"><span style="width:${pct}%"></span></div>
        <span>${doneCount}/${scheduled.length}</span>
      </div>` : ''}
    <section class="list">
      ${scheduled.map((h) => habitCard(h, key, today)).join('')}
    </section>
    ${rest.length ? `
      <h2 class="section-title">今天休息日</h2>
      <section class="list dim">${rest.map((h) => habitCard(h, key, today)).join('')}</section>` : ''}
    ${!state.habits.length ? `
      <div class="empty">
        <p>還沒有任何習慣</p>
        <button class="btn primary" data-nav="habits">＋ 新增習慣</button>
      </div>` : ''}
    ${scheduled.length && doneCount === scheduled.length ? '<p class="cheer">🎉 全部完成，太棒了！</p>' : ''}
  `;
}

// ---------- 統計頁 ----------
function heatLevel(key) {
  const sched = state.habits.filter((h) => isScheduled(h, key));
  if (!sched.length) return 0;
  const n = state.habits.filter((h) => isDone(state.done[h.id], key)).length;
  if (!n) return 0;
  const r = n / sched.length;
  return r >= 1 ? 4 : r >= 0.66 ? 3 : r >= 0.33 ? 2 : 1;
}

/** GitHub 風格熱圖：近 20 週，直欄為週、橫列為週一～週日 */
function overallHeatmap(today) {
  const weeks = 20;
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  let cols = '';
  let months = '';
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const ws = addDays(start, w * 7);
    // 跟 GitHub 一樣：在包含每月 1 號的那一週標上月份
    const m = fromKey(addDays(ws, 6)).getMonth();
    months += `<span>${w > 0 && m !== lastMonth ? `${m + 1}月` : ''}</span>`;
    lastMonth = m;
    let cells = '';
    for (let d = 0; d < 7; d++) {
      const k = addDays(ws, d);
      cells += k > today
        ? '<i class="future"></i>'
        : `<i class="l${heatLevel(k)}" title="${k}"></i>`;
    }
    cols += `<div class="col">${cells}</div>`;
  }
  return `
    <div class="gh">
      <div class="gh-months">${months}</div>
      <div class="gh-body">
        <div class="gh-days"><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span></div>
        <div class="gh-grid">${cols}</div>
      </div>
      <div class="gh-legend">少 <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> 多</div>
    </div>`;
}

/** 單一習慣的月曆熱圖，點格子可補登 */
function monthCalendar(h, y, m, today) {
  const { first, last } = monthRange(y, m);
  const map = state.done[h.id];
  const lead = (weekday(first) + 6) % 7; // 週一開頭
  let cells = '<i class="blank"></i>'.repeat(lead);
  for (let k = first; k <= last; k = addDays(k, 1)) {
    const day = fromKey(k).getDate();
    const cls = [
      isDone(map, k) ? 'on' : '',
      !isScheduled(h, k) ? 'off' : '',
      k === today ? 'today' : '',
      k > today ? 'future' : '',
    ].join(' ');
    cells += k > today
      ? `<i class="${cls}">${day}</i>`
      : `<button class="${cls}" data-cal="${esc(h.id)}" data-key="${k}" aria-label="${k}">${day}</button>`;
  }
  return `<div class="cal" style="--c:${esc(h.color)}">
    ${['一', '二', '三', '四', '五', '六', '日'].map((d) => `<b>${d}</b>`).join('')}${cells}
  </div>`;
}

function renderStats() {
  const today = todayKey();
  const { y, m } = ui.statsMonth;
  const now = new Date();
  const isCurrent = y === now.getFullYear() && m === now.getMonth();

  const cards = state.habits.map((h) => {
    const map = state.done[h.id];
    const cur = currentStreak(h, map, today);
    const best = bestStreak(h, map, today);
    const ms = monthStats(h, map, y, m, today);
    const rate = ms.rate == null ? '—' : `${Math.round(ms.rate * 100)}%`;
    return `
      <article class="card stat" style="--c:${esc(h.color)}">
        <header>
          <span class="emoji sm">${esc(h.emoji)}</span>
          <div><h3>${esc(h.name)}</h3><p>${esc(freqLabel(h))}</p></div>
        </header>
        <div class="kpis">
          <div><strong>🔥 ${cur}</strong><span>目前連續（${streakUnit(h)}）</span></div>
          <div><strong>${best}</strong><span>最長紀錄（${streakUnit(h)}）</span></div>
          <div><strong>${rate}</strong><span>${m + 1}月完成率 ${ms.expected ? `(${ms.done}/${ms.expected})` : ''}</span></div>
        </div>
        ${monthCalendar(h, y, m, today)}
        ${h.log === 'workout' ? workoutSummary(h, y, m) : ''}
      </article>`;
  }).join('');

  main.innerHTML = `
    <header class="page-head"><h1>統計</h1></header>
    <article class="card">
      <h2 class="card-title">近 20 週總覽</h2>
      ${overallHeatmap(today)}
    </article>
    <div class="month-nav">
      <button class="icon-btn" data-month="-1" aria-label="上個月">‹</button>
      <h2>${y} 年 ${m + 1} 月</h2>
      <button class="icon-btn" data-month="1" aria-label="下個月" ${isCurrent ? 'disabled' : ''}>›</button>
    </div>
    <p class="hint">點月曆上的日期可以補登或取消</p>
    ${cards || '<div class="empty"><p>還沒有任何習慣</p></div>'}
  `;
}

// ---------- 習慣管理頁 ----------
function renderHabits() {
  main.innerHTML = `
    <header class="page-head"><h1>習慣</h1></header>
    <section class="list">
      ${state.habits.map((h, i) => `
        <div class="row" style="--c:${esc(h.color)}">
          <button class="row-main" data-edit="${esc(h.id)}">
            <span class="emoji sm">${esc(h.emoji)}</span>
            <span class="info"><span class="name">${esc(h.name)}</span><span class="sub">${esc(freqLabel(h))}</span></span>
          </button>
          <button class="icon-btn sm" data-move="${i}" data-dir="-1" aria-label="上移" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn sm" data-move="${i}" data-dir="1" aria-label="下移" ${i === state.habits.length - 1 ? 'disabled' : ''}>↓</button>
        </div>`).join('')}
    </section>
    <button class="btn primary block" data-edit="">＋ 新增習慣</button>
  `;
}

const dialog = $('#editor');
let editing = null;

function openEditor(id) {
  const h = state.habits.find((x) => x.id === id);
  editing = h
    ? structuredClone(h)
    : { id: '', name: '', emoji: '✅', color: COLORS[state.habits.length % COLORS.length], freq: { type: 'daily', times: 3, days: [1, 3, 5] }, log: 'none', createdAt: todayKey() };
  if (!editing.freq.days.length) editing.freq.days = [1, 3, 5];
  if (editing.freq.type !== 'weekly') editing.freq.times = editing.freq.times > 1 ? editing.freq.times : 3;
  drawEditor();
  dialog.showModal();
  if (!h) setTimeout(() => $('#f-name').focus(), 50);
}

function drawEditor() {
  const e = editing;
  const order = [1, 2, 3, 4, 5, 6, 0];
  $('#editor-form').innerHTML = `
    <h2>${e.id ? '編輯習慣' : '新增習慣'}</h2>
    <label class="field">名稱
      <input id="f-name" maxlength="40" required value="${esc(e.name)}" placeholder="例如：喝水、保健食品" autocomplete="off">
    </label>
    <div class="field">圖示
      <div class="emoji-row">
        <input id="f-emoji" class="emoji-input" value="${esc(e.emoji)}" aria-label="自訂 emoji">
        <div class="emoji-picks">${EMOJIS.map((x) => `<button type="button" data-emoji="${x}" class="${x === e.emoji ? 'sel' : ''}">${x}</button>`).join('')}</div>
      </div>
    </div>
    <div class="field">顏色
      <div class="swatches">${COLORS.map((c) => `<button type="button" data-color="${c}" style="--c:${c}" class="${c === e.color ? 'sel' : ''}" aria-label="${c}"></button>`).join('')}</div>
    </div>
    <div class="field">頻率
      <div class="seg">
        ${[['daily', '每天'], ['weekly', '每週 N 次'], ['days', '指定星期']].map(([v, l]) => `<button type="button" data-freq="${v}" class="${e.freq.type === v ? 'sel' : ''}">${l}</button>`).join('')}
      </div>
      ${e.freq.type === 'weekly' ? `
        <div class="stepper">
          <button type="button" class="icon-btn sm" data-times="-1">−</button>
          <span>每週 <b>${e.freq.times}</b> 次</span>
          <button type="button" class="icon-btn sm" data-times="1">＋</button>
        </div>` : ''}
      ${e.freq.type === 'days' ? `
        <div class="days">${order.map((d) => `<button type="button" data-wd="${d}" class="${e.freq.days.includes(d) ? 'sel' : ''}">${WEEKDAY_LABELS[d]}</button>`).join('')}</div>` : ''}
    </div>
    <button type="button" class="switch-row" data-logtoggle aria-pressed="${e.log === 'workout'}">
      <span><b>記錄訓練內容</b><small>打勾時可另外記下部位、器材、重量、次數、組數</small></span>
      <span class="switch ${e.log === 'workout' ? 'on' : ''}"></span>
    </button>
    <div class="dialog-actions">
      ${e.id ? '<button type="button" class="btn danger" data-delete>刪除</button>' : '<span></span>'}
      <span class="spacer"></span>
      <button type="button" class="btn" data-cancel>取消</button>
      <button type="submit" class="btn primary">儲存</button>
    </div>
  `;
}

dialog.addEventListener('click', (ev) => {
  const t = ev.target.closest('button');
  if (ev.target === dialog) { dialog.close(); return; } // 點背景關閉
  if (!t) return;
  const e = editing;
  e.name = $('#f-name').value;
  e.emoji = $('#f-emoji').value.trim() || e.emoji;
  if (t.dataset.emoji) e.emoji = t.dataset.emoji;
  else if (t.dataset.color) e.color = t.dataset.color;
  else if (t.dataset.freq) e.freq.type = t.dataset.freq;
  else if (t.dataset.times) e.freq.times = Math.min(7, Math.max(1, e.freq.times + Number(t.dataset.times)));
  else if ('logtoggle' in t.dataset) e.log = e.log === 'workout' ? 'none' : 'workout';
  else if (t.dataset.wd) {
    const d = Number(t.dataset.wd);
    e.freq.days = e.freq.days.includes(d) ? e.freq.days.filter((x) => x !== d) : [...e.freq.days, d].sort();
  } else if ('cancel' in t.dataset) { dialog.close(); return; }
  else if ('delete' in t.dataset) {
    if (confirm(`確定要刪除「${e.name}」？所有打卡紀錄也會一併刪除。`)) {
      state.habits = state.habits.filter((h) => h.id !== e.id);
      delete state.done[e.id];
      delete state.workouts[e.id];
      dialog.close();
      commit();
    }
    return;
  } else return;
  drawEditor();
});

$('#editor-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const e = editing;
  e.name = $('#f-name').value.trim();
  e.emoji = $('#f-emoji').value.trim() || '✅';
  if (!e.name) { toast('請輸入名稱'); return; }
  if (e.freq.type === 'days' && !e.freq.days.length) { toast('請至少選一天'); return; }
  if (e.freq.type !== 'weekly') e.freq.times = 1;
  if (e.freq.type !== 'days') e.freq.days = [];
  if (e.id) {
    state.habits = state.habits.map((h) => (h.id === e.id ? e : h));
  } else {
    e.id = uid();
    state.habits.push(e);
  }
  dialog.close();
  commit();
});

// ---------- 重訓紀錄 ----------
const PARTS = ['胸', '背', '腿', '肩', '二頭', '三頭', '核心', '有氧'];
const wkDialog = $('#workout');
let wk = null; // { hid, date, editId, form }

const emptyForm = (part = '') => ({ part, machine: '', weight: '', reps: '', sets: '' });
const toForm = (e) => ({ part: e.part, machine: e.machine, weight: e.weight ?? '', reps: e.reps ?? '', sets: e.sets ?? '' });

/** 某習慣的所有動作，新的在前：[[日期, 動作], …] */
function allExercises(hid) {
  const days = state.workouts[hid] || {};
  return Object.keys(days).sort().reverse().flatMap((k) => days[k].map((e) => [k, e]).reverse());
}

function exerciseText(e) {
  const bits = [];
  if (e.weight) bits.push(`${e.weight} kg`);
  if (e.reps) bits.push(`${e.reps} 下`);
  if (e.sets) bits.push(`${e.sets} 組`);
  return bits.join(' × ');
}

function openWorkout(hid, date) {
  wk = { hid, date, editId: null, form: emptyForm() };
  drawWorkout();
  wkDialog.showModal();
}

function readWorkoutForm() {
  for (const k of Object.keys(wk.form)) wk.form[k] = $(`#w-${k}`).value;
}

/** 選了器材時，帶入上次的重量／次數／組數 */
function prefillFromLast(machine) {
  const last = allExercises(wk.hid).find(([, e]) => e.machine === machine)?.[1];
  if (!last) return;
  const f = wk.form;
  if (!f.part) f.part = last.part;
  Object.assign(f, { weight: last.weight ?? '', reps: last.reps ?? '', sets: last.sets ?? '' });
}

function drawWorkout() {
  const h = state.habits.find((x) => x.id === wk.hid);
  const list = state.workouts[wk.hid]?.[wk.date] || [];
  const f = wk.form;
  const history = allExercises(wk.hid);
  const parts = [...new Set([...PARTS, ...history.map(([, e]) => e.part).filter(Boolean)])];
  const seen = new Set();
  const recent = [];
  for (const [, e] of history) {
    if (!e.machine || seen.has(e.machine) || (f.part && e.part !== f.part)) continue;
    seen.add(e.machine);
    recent.push(e.machine);
    if (recent.length >= 8) break;
  }

  $('#workout-form').innerHTML = `
    <div>
      <h2>${esc(h.emoji)} ${esc(h.name)}紀錄</h2>
      <p class="muted">${formatLong(wk.date)}</p>
    </div>
    ${list.length ? `<ul class="ex-list">${list.map((e) => `
      <li class="${e.id === wk.editId ? 'editing' : ''}">
        <div class="ex-main">
          <span class="ex-name">${esc(e.machine || e.part)}${e.part && e.machine ? `<span class="tag">${esc(e.part)}</span>` : ''}</span>
          <span class="ex-sub">${esc(exerciseText(e)) || '—'}</span>
        </div>
        <button type="button" class="icon-btn sm" data-ex-edit="${esc(e.id)}" aria-label="編輯">✏️</button>
        <button type="button" class="icon-btn sm" data-ex-del="${esc(e.id)}" aria-label="刪除">🗑️</button>
      </li>`).join('')}</ul>` : '<p class="muted">還沒有紀錄，從下面新增第一個動作。</p>'}
    <div class="ex-form">
      <h3>${wk.editId ? '編輯動作' : '新增動作'}</h3>
      <div class="field">部位
        <div class="chips">${parts.map((p) => `<button type="button" data-part="${esc(p)}" class="${p === f.part ? 'sel' : ''}">${esc(p)}</button>`).join('')}</div>
        <input id="w-part" value="${esc(f.part)}" placeholder="或自己輸入部位" maxlength="20" autocomplete="off">
      </div>
      <div class="field">器材 / 動作
        ${recent.length ? `<div class="chips">${recent.map((m) => `<button type="button" data-machine="${esc(m)}" class="${m === f.machine ? 'sel' : ''}">${esc(m)}</button>`).join('')}</div>` : ''}
        <input id="w-machine" value="${esc(f.machine)}" placeholder="例如：胸推機、深蹲架、啞鈴臥推" maxlength="40" autocomplete="off">
      </div>
      <div class="num-row">
        <label class="field">重量 kg<input id="w-weight" type="number" inputmode="decimal" step="any" min="0" value="${esc(f.weight)}"></label>
        <label class="field">次數<input id="w-reps" type="number" inputmode="numeric" min="0" value="${esc(f.reps)}"></label>
        <label class="field">組數<input id="w-sets" type="number" inputmode="numeric" min="0" value="${esc(f.sets)}"></label>
      </div>
      <div class="dialog-actions">
        ${wk.editId ? '<button type="button" class="btn" data-ex-cancel>取消編輯</button>' : ''}
        <span class="spacer"></span>
        <button type="submit" class="btn primary">${wk.editId ? '更新' : '＋ 新增動作'}</button>
      </div>
    </div>
    <button type="button" class="btn block" data-wk-close>完成</button>
  `;
}

wkDialog.addEventListener('click', (ev) => {
  if (ev.target === wkDialog) { wkDialog.close(); return; }
  const t = ev.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  readWorkoutForm();
  const days = state.workouts[wk.hid] || {};
  const list = days[wk.date] || [];

  if (d.part !== undefined) wk.form.part = wk.form.part === d.part ? '' : d.part;
  else if (d.machine !== undefined) {
    wk.form.machine = d.machine;
    prefillFromLast(d.machine);
  } else if (d.exEdit) {
    const e = list.find((x) => x.id === d.exEdit);
    if (e) { wk.editId = e.id; wk.form = toForm(e); }
  } else if (d.exDel) {
    const e = list.find((x) => x.id === d.exDel);
    if (!e || !confirm(`刪除「${e.machine || e.part}」？`)) return;
    days[wk.date] = list.filter((x) => x.id !== d.exDel);
    if (!days[wk.date].length) delete days[wk.date];
    if (wk.editId === d.exDel) { wk.editId = null; wk.form = emptyForm(); }
    commit();
  } else if ('exCancel' in d) {
    wk.editId = null;
    wk.form = emptyForm(wk.form.part);
  } else if ('wkClose' in d) {
    wkDialog.close();
    return;
  } else return;
  drawWorkout();
});

// 手動輸入器材名稱時，也帶入上次的數字（只在數字都還空著時）
wkDialog.addEventListener('change', (ev) => {
  if (ev.target.id !== 'w-machine') return;
  readWorkoutForm();
  const f = wk.form;
  if (f.weight || f.reps || f.sets) return;
  prefillFromLast(f.machine.trim());
  // 直接填值、不重畫，避免使用者正在輸入的欄位失去焦點
  for (const k of ['part', 'weight', 'reps', 'sets']) $(`#w-${k}`).value = f[k];
});

$('#workout-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  readWorkoutForm();
  const e = normalizeExercise({ ...wk.form, id: wk.editId || uid() });
  if (!e) { toast('請填寫部位或器材'); return; }
  const list = ((state.workouts[wk.hid] ||= {})[wk.date] ||= []);
  const i = list.findIndex((x) => x.id === e.id);
  if (i >= 0) list[i] = e;
  else list.push(e);
  (state.done[wk.hid] ||= {})[wk.date] = 1; // 有訓練紀錄就自動打勾
  toast(wk.editId ? '已更新' : `已新增：${e.machine || e.part}`);
  wk.editId = null;
  wk.form = emptyForm(e.part); // 保留部位，方便連續輸入同部位的動作
  commit();
  drawWorkout();
});

/** 統計頁：本月部位次數、各器材最佳／最近紀錄、最近幾次訓練 */
function workoutSummary(h, y, m) {
  const days = state.workouts[h.id] || {};
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
  const partCount = {};
  for (const [k, list] of Object.entries(days)) {
    if (!k.startsWith(prefix)) continue;
    for (const p of new Set(list.map((e) => e.part).filter(Boolean))) partCount[p] = (partCount[p] || 0) + 1;
  }
  const machines = new Map(); // machine -> { last, lastDate, best }
  for (const [k, e] of allExercises(h.id)) {
    if (!e.machine) continue;
    const r = machines.get(e.machine) || { last: e, lastDate: k, best: 0 };
    r.best = Math.max(r.best, e.weight || 0);
    machines.set(e.machine, r);
  }
  const sessions = Object.keys(days).sort().reverse().slice(0, 5);
  const parts = Object.entries(partCount).sort((a, b) => b[1] - a[1]);

  return `
    <div class="wk-sum">
      <h4>${m + 1}月訓練部位</h4>
      ${parts.length ? `<div class="chips static">${parts.map(([p, n]) => `<span>${esc(p)} <b>${n}</b> 次</span>`).join('')}</div>` : '<p class="muted">這個月還沒有訓練紀錄</p>'}
      ${machines.size ? `
        <h4>器材紀錄</h4>
        <ul class="pr-list">${[...machines].slice(0, 10).map(([name, r]) => `
          <li><span>${esc(name)}</span><span class="muted-sm">最近 ${esc(exerciseText(r.last)) || '—'}${r.best ? ` · 最重 ${r.best} kg` : ''}</span></li>`).join('')}
        </ul>` : ''}
      ${sessions.length ? `
        <h4>最近訓練</h4>
        <div class="sessions">${sessions.map((k) => {
          const ps = [...new Set(days[k].map((e) => e.part).filter(Boolean))].join('、');
          return `<button data-wk-open="${k}" data-hid="${esc(h.id)}"><span>${formatLong(k)}</span><span class="muted-sm">${esc(ps)} · ${days[k].length} 個動作 ›</span></button>`;
        }).join('')}</div>` : ''}
    </div>`;
}

// ---------- 設定頁 ----------
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (ui.view === 'settings') render();
});

function backupFile() {
  return new File([exportJSON(state)], `habits-backup-${todayKey()}.json`, { type: 'application/json' });
}

function renderSettings() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const canShare = !!navigator.canShare?.({ files: [backupFile()] });
  const t = state.settings.theme;
  main.innerHTML = `
    <header class="page-head"><h1>設定</h1></header>
    <article class="card">
      <h2 class="card-title">外觀</h2>
      <div class="seg">
        ${[['auto', '跟隨系統'], ['light', '淺色'], ['dark', '深色']].map(([v, l]) => `<button data-theme-set="${v}" class="${t === v ? 'sel' : ''}">${l}</button>`).join('')}
      </div>
    </article>
    <article class="card">
      <h2 class="card-title">備份</h2>
      <p class="muted">資料只存在這台裝置的瀏覽器裡。建議定期匯出備份，換手機或清除瀏覽器資料前一定要先匯出。</p>
      <div class="btn-col">
        <button class="btn" data-export>⬇️ 下載備份（JSON）</button>
        ${canShare ? '<button class="btn" data-share>📤 分享 / 存到檔案</button>' : ''}
        <label class="btn">📥 從 JSON 匯入<input type="file" accept="application/json,.json" data-import hidden></label>
      </div>
    </article>
    ${!standalone ? `
    <article class="card">
      <h2 class="card-title">加到主畫面</h2>
      ${deferredInstall ? '<button class="btn primary block" data-install>安裝 App</button>' : `
      <p class="muted">iPhone（Safari）：點下方「分享」按鈕 → 「加入主畫面」。<br>Android（Chrome）：右上角選單 → 「安裝應用程式」或「加到主畫面」。</p>`}
    </article>` : ''}
    <article class="card">
      <h2 class="card-title">危險區域</h2>
      <button class="btn danger block" data-reset>清除所有資料</button>
    </article>
    <p class="muted center">習慣追蹤 · 離線可用 · 資料不會上傳</p>
  `;
}

function download(file) {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- 路由與事件 ----------
const VIEWS = { today: renderToday, stats: renderStats, habits: renderHabits, settings: renderSettings };

function render() {
  applyTheme();
  VIEWS[ui.view]();
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.view === ui.view));
}

function route() {
  const v = location.hash.slice(1);
  ui.view = VIEWS[v] ? v : 'today';
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

main.addEventListener('click', async (ev) => {
  const t = ev.target.closest('button, [data-nav]');
  if (!t) return;
  const d = t.dataset;

  if (d.toggle) toggle(d.toggle, ui.date);
  else if (d.log) openWorkout(d.log, ui.date);
  else if (d.wkOpen) openWorkout(d.hid, d.wkOpen);
  else if (d.cal) toggle(d.cal, d.key);
  else if (d.day) {
    const today = todayKey();
    ui.date = d.day === 'today' ? today : addDays(ui.date, Number(d.day));
    if (ui.date > today) ui.date = today;
    ui.followToday = ui.date === today;
    render();
  } else if (d.month) {
    const dt = new Date(ui.statsMonth.y, ui.statsMonth.m + Number(d.month), 1);
    ui.statsMonth = { y: dt.getFullYear(), m: dt.getMonth() };
    render();
  } else if (d.nav) location.hash = d.nav;
  else if ('edit' in d) openEditor(d.edit);
  else if (d.move) {
    const i = Number(d.move);
    const j = i + Number(d.dir);
    [state.habits[i], state.habits[j]] = [state.habits[j], state.habits[i]];
    commit();
  } else if (d.themeSet) {
    state.settings.theme = d.themeSet;
    commit();
  } else if ('export' in d) download(backupFile());
  else if ('share' in d) {
    try { await navigator.share({ files: [backupFile()], title: '習慣追蹤備份' }); } catch { /* 使用者取消 */ }
  } else if ('install' in d) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    render();
  } else if ('reset' in d) {
    if (confirm('確定要清除所有習慣與紀錄？此動作無法復原（建議先匯出備份）。')) {
      state = defaultState();
      commit();
      toast('已重設為預設習慣');
    }
  }
});

main.addEventListener('change', async (ev) => {
  const input = ev.target;
  if (!('import' in input.dataset) || !input.files[0]) return;
  try {
    const next = importJSON(await input.files[0].text());
    const n = Object.values(next.done).reduce((s, m) => s + Object.keys(m).length, 0);
    if (confirm(`將以備份檔取代目前資料：${next.habits.length} 個習慣、${n} 筆打卡紀錄。確定匯入？`)) {
      state = next;
      commit();
      toast('✅ 匯入完成');
    }
  } catch (e) {
    toast(`匯入失敗：${e.message}`);
  }
  input.value = '';
});

// 跨日（App 放在背景過夜）時自動切到新的一天
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (ui.followToday) ui.date = todayKey();
  render();
});

// 其他分頁修改資料時同步
window.addEventListener('storage', () => { state = load(); render(); });

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 註冊失敗', e));
  // 新版 SW 接手後自動重新載入一次，套用新版本
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

route();
