import { getCandles } from '../core/data.js';
import { timeMachine } from '../core/timemachine.js';

const SYMBOL_RE = /^[A-Z0-9]{3,12}(\/[A-Z0-9]{3,6})?$/;
const INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d'];

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const market = q.market === 'forex' ? 'forex' : 'crypto';
    const symbol = String(q.symbol || '').toUpperCase();
    const interval = INTERVALS.includes(q.interval) ? q.interval : '1h';
    const side = q.side === 'long' || q.side === 'short' ? q.side : undefined;
    const rr = Math.min(10, Math.max(0.5, Number(q.rr) || 2));
    const runs = Math.min(20000, Math.max(1000, Number(q.runs) || 10000));

    if (!SYMBOL_RE.test(symbol)) {
      res.status(400).json({ error: 'invalid symbol' });
      return;
    }

    const candles = await getCandles({
      market, symbol, interval, limit: 1000, apiKey: process.env.TWELVE_DATA_API_KEY,
    });
    const out = timeMachine(candles, { rr, runs, side });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ market, symbol, interval, ...out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
