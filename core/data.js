// ক্যান্ডেল ডেটা আনে। ফরম্যাট: { t, o, h, l, c, v }
// Binance public market-data endpoint (US IP-তেও কাজ করে, GitHub Actions-এর জন্য দরকারি)
const BINANCE = 'https://data-api.binance.vision/api/v3/klines';
const TD = 'https://api.twelvedata.com/time_series';

const TD_INTERVAL = {
  '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
  '1h': '1h', '4h': '4h', '1d': '1day',
};

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

async function crypto({ symbol, interval, limit }) {
  const url = `${BINANCE}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
  const rows = await getJson(url);
  if (!Array.isArray(rows)) throw new Error(rows.msg || 'Binance error');
  return rows.map((r) => ({
    t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5],
  }));
}

async function forex({ symbol, interval, limit, apiKey }) {
  if (!apiKey) throw new Error('TWELVE_DATA_API_KEY সেট করা নেই');
  const iv = TD_INTERVAL[interval];
  if (!iv) throw new Error(`Unsupported interval: ${interval}`);
  const url = `${TD}?symbol=${encodeURIComponent(symbol)}&interval=${iv}&outputsize=${limit}&order=ASC&apikey=${apiKey}`;
  const j = await getJson(url);
  if (j.status === 'error' || !j.values) throw new Error(j.message || 'Twelve Data error');
  return j.values.map((r) => ({
    t: Date.parse(r.datetime.replace(' ', 'T') + 'Z'),
    o: +r.open, h: +r.high, l: +r.low, c: +r.close, v: +(r.volume || 0),
  }));
}

/** শেষ (চলমান, অসম্পূর্ণ) ক্যান্ডেল বাদ দিয়ে ফেরত দেয়। */
export async function getCandles({ market, symbol, interval = '1h', limit = 1000, apiKey }) {
  const fn = market === 'forex' ? forex : crypto;
  const candles = await fn({ symbol, interval, limit, apiKey });
  candles.pop();
  if (candles.length < 100) throw new Error('যথেষ্ট ক্যান্ডেল পাওয়া যায়নি');
  return candles;
}
