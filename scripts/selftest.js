// নেটওয়ার্ক ছাড়াই synthetic ডেটায় লজিক যাচাই।
import assert from 'node:assert/strict';
import { findSignals } from '../core/strategy.js';
import { timeMachine } from '../core/timemachine.js';

let s = 12345;
const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const candles = [];
let p = 100;
for (let i = 0; i < 1000; i++) {
  const o = p;
  const c = o * (1 + (rand() - 0.5) * 0.02);
  const h = Math.max(o, c) * (1 + rand() * 0.006);
  const l = Math.min(o, c) * (1 - rand() * 0.006);
  candles.push({ t: i * 3600000, o, h, l, c, v: 1 });
  p = c;
}

const sigs = findSignals(candles);
assert.ok(sigs.length > 10, 'সিগন্যাল পাওয়া উচিত');
for (const g of sigs) {
  assert.ok(g.side === 'long' ? g.sl < g.entry && g.tp > g.entry : g.sl > g.entry && g.tp < g.entry);
}

const out = timeMachine(candles, { side: 'long', runs: 10000 });
const b = out.bootstrap;
assert.ok(Math.abs(b.probTP + b.probSL + b.probTimeout - 1) < 1e-9, 'probability sum = 1');
assert.ok(out.history.n > 5);
console.log('signals:', sigs.length);
console.log('bootstrap:', b);
console.log('history:', out.history);
console.log('OK');
