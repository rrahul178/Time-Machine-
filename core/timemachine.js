import { atr, simulate } from './strategy.js';
import { getSignals } from './signals.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

/** এই সেটআপ অতীতে যতবার এসেছে, প্রতিবারের ফলাফল। */
export function historicalStats(c, side, { rr, horizon, pivotLen, excludeI, strategy, setup }) {
  const sigs = getSignals(c, { strategy, pivotLen, rr }).filter(
    (s) => s.side === side && (!setup || s.setup === setup)
      && s.i !== excludeI && s.i + horizon <= c.length - 1,
  );
  let wins = 0, losses = 0, timeouts = 0, sumR = 0, grossW = 0, grossL = 0;
  for (const s of sigs) {
    const { r, outcome } = simulate(c, s, horizon);
    sumR += r;
    if (r > 0) grossW += r; else grossL += -r;
    if (outcome === 'tp') wins++;
    else if (outcome === 'sl') losses++;
    else timeouts++;
  }
  const n = sigs.length;
  return {
    n, wins, losses, timeouts,
    winRate: n ? wins / n : null,
    expectancyR: n ? sumR / n : null,
    profitFactor: grossL ? grossW / grossL : n ? null : null,
  };
}

/** সাম্প্রতিক বারের (close/high/low ÷ আগের close) রেশিও থেকে bootstrap করে বাকি সেশন সিমুলেট। */
export function bootstrap(c, sig, { runs, horizon, lookback, seed }) {
  const start = Math.max(1, c.length - lookback);
  const bars = [];
  for (let i = start; i < c.length; i++) {
    const pc = c[i - 1].c;
    bars.push([c[i].c / pc, c[i].h / pc, c[i].l / pc]);
  }
  const rand = rng(seed);
  const dir = sig.side === 'long' ? 1 : -1;
  let tp = 0, sl = 0, to = 0;
  const finals = new Array(runs);
  let sumR = 0;

  for (let r = 0; r < runs; r++) {
    let p = sig.entry;
    let res = null;
    for (let s = 0; s < horizon; s++) {
      const b = bars[Math.floor(rand() * bars.length)];
      const hi = p * b[1];
      const lo = p * b[2];
      const hitSL = dir === 1 ? lo <= sig.sl : hi >= sig.sl;
      if (hitSL) { res = -1; sl++; break; }
      const hitTP = dir === 1 ? hi >= sig.tp : lo <= sig.tp;
      if (hitTP) { res = sig.rr; tp++; break; }
      p *= b[0];
    }
    if (res === null) { res = ((p - sig.entry) * dir) / sig.risk; to++; }
    finals[r] = res;
    sumR += res;
  }
  finals.sort((x, y) => x - y);
  return {
    runs,
    probTP: tp / runs,
    probSL: sl / runs,
    probTimeout: to / runs,
    expectedR: sumR / runs,
    p5: pct(finals, 0.05),
    p50: pct(finals, 0.5),
    p95: pct(finals, 0.95),
  };
}

export function timeMachine(c, opts = {}) {
  const {
    rr = 2, horizon = 24, runs = 10000, pivotLen = 3,
    recent = 2, side, lookback = 500, seed = 42, strategy = 'all',
  } = opts;
  const last = c.length - 1;
  const sigs = getSignals(c, { strategy, pivotLen, rr });
  let sig = [...sigs].reverse().find((s) => s.i >= last - recent && (!side || s.side === side));
  let hypothetical = false;

  if (!sig) {
    if (!side) {
      return { signal: null, price: c[last].c, history: null, bootstrap: null,
        note: 'এই মুহূর্তে সক্রিয় সিগন্যাল নেই। side=long|short দিলে হাইপোথেটিক্যাল ট্রেড সিমুলেট হবে।' };
    }
    const a = atr(c)[last];
    sig = {
      side, i: last, t: c[last].t, entry: c[last].c, risk: 1.5 * a, rr,
      sl: c[last].c - (side === 'long' ? 1 : -1) * 1.5 * a,
      tp: c[last].c + (side === 'long' ? 1 : -1) * rr * 1.5 * a,
    };
    hypothetical = true;
  }

  const history = historicalStats(c, sig.side, {
    rr, horizon, pivotLen, strategy, setup: hypothetical ? undefined : sig.setup,
    excludeI: hypothetical ? -1 : sig.i,
  });
  const boot = bootstrap(c, sig, { runs, horizon, lookback, seed });

  return {
    price: c[last].c,
    signal: {
      setup: sig.setup ?? null, side: sig.side, entry: sig.entry, sl: sig.sl, tp: sig.tp, rr: sig.rr,
      risk: sig.risk, barsAgo: last - sig.i, time: sig.t, hypothetical,
    },
    bootstrap: boot,
    history,
    meta: { candles: c.length, horizon, runs, lookback },
  };
}
