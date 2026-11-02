import { positionSize, checkRisk } from './risk.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x, d = 4) => (x == null ? '-' : Number(x).toFixed(Math.abs(x) >= 100 ? 2 : d));
const pc = (x) => (x == null ? '-' : (x * 100).toFixed(1) + '%');

let selected = null; // { market, symbol, interval }
let lastTM = null;

async function loadScan() {
  const body = $('#scan tbody');
  try {
    const r = await fetch('data/scan.json?' + Date.now());
    const j = await r.json();
    $('#updated').textContent = j.updatedAt ? 'আপডেট: ' + new Date(j.updatedAt).toLocaleString() : 'এখনও স্ক্যান চলেনি';
    body.innerHTML = '';
    for (const row of j.results) {
      const tr = document.createElement('tr');
      const sig = row.signal ? `<span class="${row.signal.side}">${row.signal.side.toUpperCase()}</span>` : '<span class="muted">—</span>';
      tr.innerHTML = row.error
        ? `<td>${esc(row.market)}</td><td>${esc(row.symbol)}</td><td>${esc(row.interval)}</td><td colspan="4" class="bad">${esc(row.error)}</td>`
        : `<td>${esc(row.market)}</td><td>${esc(row.symbol)}</td><td>${esc(row.interval)}</td><td>${num(row.price)}</td><td>${sig}</td><td>${pc(row.probTP)}</td><td>${pc(row.hist?.winRate)}</td>`;
      tr.addEventListener('click', () => {
        document.querySelectorAll('#scan tr.sel').forEach((e) => e.classList.remove('sel'));
        tr.classList.add('sel');
        selected = { market: row.market, symbol: row.symbol, interval: row.interval };
        runTM('');
      });
      body.appendChild(tr);
    }
  } catch {
    body.innerHTML = '<tr><td colspan="7" class="bad">scan.json লোড হয়নি</td></tr>';
  }
}

async function runTM(side) {
  if (!selected) return;
  $('#tm-title').textContent = `— ${selected.symbol} ${selected.interval}`;
  const out = $('#tm-out');
  out.textContent = 'সিমুলেট করছি…';
  const qs = new URLSearchParams({ ...selected, ...(side ? { side } : {}) });
  try {
    const r = await fetch('/api/timemachine?' + qs);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    lastTM = j;
    renderTM(j);
    renderRisk();
  } catch (e) {
    lastTM = null;
    out.innerHTML = `<span class="bad">${esc(e.message)}</span>`;
  }
}

function renderTM(j) {
  const out = $('#tm-out');
  if (!j.signal) { out.textContent = j.note; return; }
  const s = j.signal;
  const b = j.bootstrap;
  const h = j.history;
  out.innerHTML = `
    <p><span class="${s.side}">${s.side.toUpperCase()}</span> ${s.hypothetical ? '(হাইপোথেটিক্যাল)' : `(${s.barsAgo} বার আগে)`}
       — Entry ${num(s.entry)} · SL ${num(s.sl)} · TP ${num(s.tp)} · RR ${s.rr}</p>
    <div class="kv">
      <div>TP আগে লাগার সম্ভাবনা<b>${pc(b.probTP)}</b></div>
      <div>SL আগে লাগার সম্ভাবনা<b>${pc(b.probSL)}</b></div>
      <div>টাইমআউট<b>${pc(b.probTimeout)}</b></div>
      <div>Expected R<b>${num(b.expectedR, 2)}</b></div>
      <div>R (5% / 50% / 95%)<b>${num(b.p5, 2)} / ${num(b.p50, 2)} / ${num(b.p95, 2)}</b></div>
    </div>
    <div class="bar" title="TP / SL / timeout">
      <i style="width:${b.probTP * 100}%;background:var(--green)"></i>
      <i style="width:${b.probTimeout * 100}%;background:#8b92a3"></i>
      <i style="width:${b.probSL * 100}%;background:var(--red)"></i>
    </div>
    <p class="muted">${b.runs.toLocaleString()} সিমুলেশন, ${j.meta.horizon} বার হরাইজন।</p>
    <p>অতীতে একই সেটআপ: <b>${h.n}</b> বার · win ${pc(h.winRate)} · expectancy ${num(h.expectancyR, 2)}R
       · profit factor ${h.profitFactor == null ? '-' : h.profitFactor.toFixed(2)}</p>`;
}

const ids = ['capital', 'riskPct', 'dailyLimit', 'dayPnl', 'tradesToday', 'maxTrades'];
const val = (id) => Number($('#' + id).value);

function renderRisk() {
  const out = $('#risk-out');
  if (!lastTM?.signal) { out.textContent = 'Time Machine চালালে এখানে পজিশন সাইজ দেখাবে।'; return; }
  const s = lastTM.signal;
  const size = positionSize({ capital: val('capital'), riskPct: val('riskPct'), entry: s.entry, sl: s.sl, market: lastTM.market });
  const chk = checkRisk({
    capital: val('capital'), riskPct: val('riskPct'), dailyLossLimitPct: val('dailyLimit'),
    dayPnl: val('dayPnl'), tradesToday: val('tradesToday'), maxTradesPerDay: val('maxTrades'), rr: s.rr,
  });
  out.innerHTML = `
    <p class="${chk.ok ? 'ok' : 'bad'}">${chk.ok ? 'ALLOW — সব লিমিটের মধ্যে' : 'BLOCK'}</p>
    ${chk.reasons.map((r) => `<div class="bad">• ${esc(r)}</div>`).join('')}
    ${size ? `<div class="kv">
      <div>ঝুঁকির পরিমাণ<b>${num(size.riskAmt, 2)}</b></div>
      <div>ইউনিট<b>${num(size.units, 4)}</b></div>
      ${size.lots != null ? `<div>লট (আনুমানিক)<b>${num(size.lots, 3)}</b></div>` : ''}
      <div>Notional<b>${num(size.notional, 2)}</b></div></div>` : ''}`;
}

// ইনপুট localStorage-এ সংরক্ষণ
for (const id of ids) {
  try { const v = localStorage.getItem('tl_' + id); if (v != null) $('#' + id).value = v; } catch {}
  $('#' + id).addEventListener('input', () => {
    try { localStorage.setItem('tl_' + id, $('#' + id).value); } catch {}
    renderRisk();
  });
}
document.querySelectorAll('button[data-side]').forEach((b) => b.addEventListener('click', () => runTM(b.dataset.side)));

loadScan();
