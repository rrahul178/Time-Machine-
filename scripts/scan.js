// GitHub Actions থেকে চলে: watchlist স্ক্যান করে public/data/scan.json লেখে।
import { readFileSync, writeFileSync } from 'node:fs';
import { getCandles } from '../core/data.js';
import { timeMachine } from '../core/timemachine.js';

const cfg = JSON.parse(readFileSync(new URL('../config/watchlist.json', import.meta.url), 'utf8'));
const apiKey = process.env.TWELVE_DATA_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

for (const market of ['crypto', 'forex']) {
  const conf = cfg[market];
  if (!conf) continue;
  for (const symbol of conf.symbols) {
    const row = { market, symbol, interval: conf.interval };
    try {
      const candles = await getCandles({ market, symbol, interval: conf.interval, limit: 1000, apiKey });
      const tm = timeMachine(candles, { runs: 5000 });
      row.price = tm.price;
      row.signal = tm.signal;
      row.probTP = tm.bootstrap?.probTP ?? null;
      row.expectedR = tm.bootstrap?.expectedR ?? null;
      row.hist = tm.history
        ? { n: tm.history.n, winRate: tm.history.winRate, expectancyR: tm.history.expectancyR }
        : null;
    } catch (e) {
      row.error = e.message;
    }
    results.push(row);
    console.log(market, symbol, row.error ? `ERR ${row.error}` : row.signal ? row.signal.side : 'no signal');
    // Twelve Data ফ্রি প্ল্যান: মিনিটে ৮ রিকোয়েস্ট
    if (market === 'forex') await sleep(8000);
  }
}

writeFileSync(
  new URL('../public/data/scan.json', import.meta.url),
  JSON.stringify({ updatedAt: new Date().toISOString(), results }, null, 2),
);
