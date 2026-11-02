// ICT সেটআপ: Order Block, FVG, IFVG
// সব ডিটেক্টর non-repainting: সিগন্যাল হয় রিটেস্ট ক্যান্ডেল ক্লোজ হওয়ার পর, ভবিষ্যৎ বার দেখে না।
// আউটপুট ফরম্যাট strategy.js-এর মতোই: { setup, side, i, t, entry, risk, rr, sl, tp }
import { atr } from './strategy.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function mk(setup, side, i, c, slRaw, rr, a) {
  const dir = side === 'long' ? 1 : -1;
  const entry = c[i].c;
  const risk = clamp(Math.abs(entry - slRaw), 0.5 * a, 3 * a);
  return {
    setup, side, i, t: c[i].t, entry, risk, rr,
    sl: entry - dir * risk,
    tp: entry + dir * rr * risk,
  };
}

/** প্রতি বারে: সর্বশেষ নিশ্চিত swing high/low এবং structure bias (+1 / -1 / 0)। */
function structure(c, n) {
  const hi = new Array(c.length).fill(null);
  const lo = new Array(c.length).fill(null);
  const bias = new Array(c.length).fill(0);
  let H = null, L = null, b = 0;
  for (let i = 0; i < c.length; i++) {
    const j = i - n;
    if (j >= n) {
      let isH = true, isL = true;
      for (let k = j - n; k <= j + n; k++) {
        if (k === j) continue;
        if (c[k].h >= c[j].h) isH = false;
        if (c[k].l <= c[j].l) isL = false;
      }
      if (isH) H = { price: c[j].h, broken: false };
      if (isL) L = { price: c[j].l, broken: false };
    }
    if (H && !H.broken && c[i].c > H.price) { H.broken = true; b = 1; }
    if (L && !L.broken && c[i].c < L.price) { L.broken = true; b = -1; }
    hi[i] = H ? H.price : null;
    lo[i] = L ? L.price : null;
    bias[i] = b;
  }
  return { hi, lo, bias };
}

/** i-তে নতুন FVG তৈরি হলো কিনা (৩ ক্যান্ডেল, মাঝেরটা ইমপালস)। */
function newGap(c, i, a, minGapAtr) {
  if (i < 2 || !a[i]) return null;
  if (c[i - 2].h < c[i].l && c[i].l - c[i - 2].h >= minGapAtr * a[i] && c[i - 1].c > c[i - 1].o) {
    return { side: 'long', top: c[i].l, bottom: c[i - 2].h, i };
  }
  if (c[i - 2].l > c[i].h && c[i - 2].l - c[i].h >= minGapAtr * a[i] && c[i - 1].c < c[i - 1].o) {
    return { side: 'short', top: c[i - 2].l, bottom: c[i].h, i };
  }
  return null;
}

/**
 * FVG রিটেস্ট: গ্যাপ তৈরির পর প্রাইস গ্যাপে ঢুকে rejection ক্যান্ডেল ক্লোজ করলে এন্ট্রি।
 * গ্যাপ ভেঙে ক্লোজ হলে বাতিল (সেটা IFVG-র এলাকা)।
 */
export function findFVG(c, { rr = 2, pivotLen = 3, useBias = true, maxAge = 40, minGapAtr = 0.3 } = {}) {
  const a = atr(c);
  const st = structure(c, pivotLen);
  const sigs = [];
  let zones = [];
  for (let i = 2; i < c.length; i++) {
    zones = zones.filter((z) => {
      if (i - z.i > maxAge) return false;
      if (z.side === 'long') {
        if (c[i].c < z.bottom) return false;
        if (a[i] && c[i].l <= z.top && c[i].c > c[i].o && (!useBias || st.bias[i] === 1)) {
          sigs.push(mk('fvg', 'long', i, c, z.bottom - 0.1 * a[i], rr, a[i]));
          return false;
        }
      } else {
        if (c[i].c > z.top) return false;
        if (a[i] && c[i].h >= z.bottom && c[i].c < c[i].o && (!useBias || st.bias[i] === -1)) {
          sigs.push(mk('fvg', 'short', i, c, z.top + 0.1 * a[i], rr, a[i]));
          return false;
        }
      }
      return true;
    });
    const g = newGap(c, i, a, minGapAtr);
    if (g && (!useBias || st.bias[i] === (g.side === 'long' ? 1 : -1))) zones.push(g);
  }
  return sigs;
}

/**
 * IFVG: একটি FVG শক্ত displacement ক্যান্ডেলে উল্টো দিকে ক্লোজ হয়ে ভাঙলে সেটা inversion zone হয়।
 * পরে প্রাইস ওই জোনে ফিরে rejection দিলে নতুন দিকে এন্ট্রি
 * (ভাঙা bullish FVG => short, ভাঙা bearish FVG => long)।
 */
export function findIFVG(c, {
  rr = 2, pivotLen = 3, useBias = true, maxAge = 40, minGapAtr = 0.3, invBodyAtr = 0.8,
} = {}) {
  const a = atr(c);
  const st = structure(c, pivotLen);
  const sigs = [];
  let zones = [];
  let inv = [];
  for (let i = 2; i < c.length; i++) {
    inv = inv.filter((z) => {
      if (i - z.i > maxAge) return false;
      if (z.side === 'short') {
        if (c[i].c > z.top) return false;
        if (a[i] && c[i].h >= z.bottom && c[i].c < c[i].o && (!useBias || st.bias[i] === -1)) {
          sigs.push(mk('ifvg', 'short', i, c, z.top + 0.1 * a[i], rr, a[i]));
          return false;
        }
      } else {
        if (c[i].c < z.bottom) return false;
        if (a[i] && c[i].l <= z.top && c[i].c > c[i].o && (!useBias || st.bias[i] === 1)) {
          sigs.push(mk('ifvg', 'long', i, c, z.bottom - 0.1 * a[i], rr, a[i]));
          return false;
        }
      }
      return true;
    });

    zones = zones.filter((z) => {
      if (i - z.i > maxAge) return false;
      const body = Math.abs(c[i].c - c[i].o);
      const strong = a[i] && body >= invBodyAtr * a[i];
      if (z.side === 'long' && c[i].c < z.bottom) {
        if (strong) inv.push({ side: 'short', top: z.top, bottom: z.bottom, i });
        return false;
      }
      if (z.side === 'short' && c[i].c > z.top) {
        if (strong) inv.push({ side: 'long', top: z.top, bottom: z.bottom, i });
        return false;
      }
      return true;
    });

    const g = newGap(c, i, a, minGapAtr);
    if (g) zones.push(g);
  }
  return sigs;
}

/**
 * Order Block: Liquidity Sweep => MSS/CHoCH (displacement ক্যান্ডেলে) => OB রিটেস্ট।
 * Bullish: swing low sweep করে ফেরত ক্লোজ, তারপর swing high ভেঙে শক্ত bullish ক্যান্ডেল।
 * OB = sweep থেকে MSS-এর মধ্যে শেষ bearish ক্যান্ডেল। প্রাইস OB-তে ফিরে rejection দিলে এন্ট্রি।
 */
export function findOB(c, {
  rr = 2, pivotLen = 3, sweepWindow = 10, dispAtr = 1.2, maxAge = 30,
} = {}) {
  const a = atr(c);
  const st = structure(c, pivotLen);
  const sigs = [];
  let obs = [];
  let sweepBull = null;
  let sweepBear = null;

  for (let i = 1; i < c.length; i++) {
    obs = obs.filter((z) => {
      if (i - z.born > maxAge) return false;
      if (z.side === 'long') {
        if (c[i].c < z.bottom) return false;
        if (a[i] && c[i].l <= z.top && c[i].c > c[i].o) {
          sigs.push(mk('ob', 'long', i, c, z.bottom - 0.1 * a[i], rr, a[i]));
          return false;
        }
      } else {
        if (c[i].c > z.top) return false;
        if (a[i] && c[i].h >= z.bottom && c[i].c < c[i].o) {
          sigs.push(mk('ob', 'short', i, c, z.top + 0.1 * a[i], rr, a[i]));
          return false;
        }
      }
      return true;
    });

    if (!a[i]) continue;
    const H = st.hi[i];
    const L = st.lo[i];
    if (L != null && c[i].l < L && c[i].c > L) sweepBull = { i, level: L };
    if (H != null && c[i].h > H && c[i].c < H) sweepBear = { i, level: H };

    if (sweepBull && i - sweepBull.i <= sweepWindow && H != null
        && c[i].c > H && c[i].c - c[i].o >= dispAtr * a[i]) {
      let k = -1;
      for (let q = i - 1; q >= sweepBull.i; q--) if (c[q].c < c[q].o) { k = q; break; }
      if (k >= 0) obs.push({ side: 'long', top: c[k].h, bottom: c[k].l, born: i });
      sweepBull = null;
    }
    if (sweepBear && i - sweepBear.i <= sweepWindow && L != null
        && c[i].c < L && c[i].o - c[i].c >= dispAtr * a[i]) {
      let k = -1;
      for (let q = i - 1; q >= sweepBear.i; q--) if (c[q].c > c[q].o) { k = q; break; }
      if (k >= 0) obs.push({ side: 'short', top: c[k].h, bottom: c[k].l, born: i });
      sweepBear = null;
    }
  }
  return sigs;
}
