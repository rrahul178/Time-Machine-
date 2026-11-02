// সিগন্যাল লজিক: swing pivot ভেঙে ক্লোজ (BOS) => এন্ট্রি।
// এখানে আপনার নিজের স্ট্র্যাটেজি (CHoCH, order block ইত্যাদি) বসাতে পারেন:
// শুধু findSignals() একই আউটপুট ফরম্যাটে ফেরত দিলেই বাকি সব কাজ করবে।

export function atr(c, period = 14) {
  const out = new Array(c.length).fill(null);
  let prev = null;
  let sum = 0;
  for (let i = 1; i < c.length; i++) {
    const tr = Math.max(
      c[i].h - c[i].l,
      Math.abs(c[i].h - c[i - 1].c),
      Math.abs(c[i].l - c[i - 1].c),
    );
    if (i <= period) {
      sum += tr;
      if (i === period) { prev = sum / period; out[i] = prev; }
    } else {
      prev = (prev * (period - 1) + tr) / period;
      out[i] = prev;
    }
  }
  return out;
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function make(side, i, entry, risk, rr, t) {
  const dir = side === 'long' ? 1 : -1;
  return {
    side, i, t, entry, risk, rr,
    sl: entry - dir * risk,
    tp: entry + dir * rr * risk,
  };
}

/**
 * @param c ক্যান্ডেল অ্যারে
 * @param {{pivotLen?:number, rr?:number}} opts
 */
export function findSignals(c, { pivotLen = 3, rr = 2 } = {}) {
  const n = pivotLen;
  const a = atr(c);
  const sigs = [];
  let lastH = null;
  let lastL = null;

  for (let i = 2 * n; i < c.length; i++) {
    const j = i - n; // j-তে pivot নিশ্চিত হয় i-তে এসে (lookahead নেই)
    let isH = true;
    let isL = true;
    for (let k = j - n; k <= j + n; k++) {
      if (k === j) continue;
      if (c[k].h >= c[j].h) isH = false;
      if (c[k].l <= c[j].l) isL = false;
    }
    if (isH) lastH = { price: c[j].h, broken: false };
    if (isL) lastL = { price: c[j].l, broken: false };
    if (!a[i]) continue;

    if (lastH && !lastH.broken && c[i].c > lastH.price) {
      lastH.broken = true;
      const entry = c[i].c;
      const raw = lastL ? entry - lastL.price : 1.5 * a[i];
      sigs.push(make('long', i, entry, clamp(raw, 0.5 * a[i], 3 * a[i]), rr, c[i].t));
    }
    if (lastL && !lastL.broken && c[i].c < lastL.price) {
      lastL.broken = true;
      const entry = c[i].c;
      const raw = lastH ? lastH.price - entry : 1.5 * a[i];
      sigs.push(make('short', i, entry, clamp(raw, 0.5 * a[i], 3 * a[i]), rr, c[i].t));
    }
  }
  return sigs;
}

/** সিগন্যালের পরের ক্যান্ডেলগুলোতে SL/TP কোনটা আগে লাগে। একই বারে দুটোই লাগলে SL ধরা হয় (রক্ষণশীল)। */
export function simulate(c, sig, maxBars) {
  const dir = sig.side === 'long' ? 1 : -1;
  const end = Math.min(sig.i + maxBars, c.length - 1);
  for (let k = sig.i + 1; k <= end; k++) {
    const hitSL = dir === 1 ? c[k].l <= sig.sl : c[k].h >= sig.sl;
    if (hitSL) return { r: -1, outcome: 'sl' };
    const hitTP = dir === 1 ? c[k].h >= sig.tp : c[k].l <= sig.tp;
    if (hitTP) return { r: sig.rr, outcome: 'tp' };
  }
  return { r: ((c[end].c - sig.entry) * dir) / sig.risk, outcome: 'timeout' };
}
