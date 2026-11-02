// সব স্ট্র্যাটেজির একটাই প্রবেশপথ।
import { findSignals as findBOS } from './strategy.js';
import { findOB, findFVG, findIFVG } from './ict.js';

export const STRATEGIES = ['all', 'ob', 'fvg', 'ifvg', 'bos'];

/** strategy: 'ob' | 'fvg' | 'ifvg' | 'bos' | 'all' (= ob + fvg + ifvg) */
export function getSignals(c, { strategy = 'all', rr = 2, pivotLen = 3 } = {}) {
  const o = { rr, pivotLen };
  switch (strategy) {
    case 'ob': return findOB(c, o);
    case 'fvg': return findFVG(c, o);
    case 'ifvg': return findIFVG(c, o);
    case 'bos': return findBOS(c, o);
    default:
      return [...findOB(c, o), ...findFVG(c, o), ...findIFVG(c, o)].sort((x, y) => x.i - y.i);
  }
}
