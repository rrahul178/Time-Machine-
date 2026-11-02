# Trade Lab

Crypto (Binance) + Forex (Twelve Data) এর জন্য Scanner, Time Machine আর Risk Manager। শুধু GitHub + Vercel লাগে, কোনো dependency নেই।

## কাঠামো

| পথ | কাজ |
|---|---|
| `core/data.js` | Binance/Twelve Data থেকে ক্যান্ডেল আনে |
| `core/strategy.js` | সিগন্যাল লজিক (swing BOS), ATR, ট্রেড সিমুলেটর |
| `core/timemachine.js` | ১০,০০০ বার bootstrap সিমুলেশন + অতীতের একই সেটআপের ফলাফল |
| `api/timemachine.js` | Vercel serverless endpoint |
| `scripts/scan.js` | watchlist স্ক্যান করে `public/data/scan.json` লেখে |
| `.github/workflows/scan.yml` | প্রতি ঘণ্টায় স্ক্যান চালিয়ে commit করে |
| `public/` | Dashboard + Risk Manager (ব্রাউজারে) |
| `config/watchlist.json` | symbol ও টাইমফ্রেম |

## সেটআপ

1. GitHub-এ নতুন repo বানিয়ে এই ফোল্ডার push করুন।
2. Twelve Data থেকে ফ্রি API key নিন। GitHub repo → Settings → Secrets and variables → Actions → `TWELVE_DATA_API_KEY` যোগ করুন।
3. Vercel-এ repo import করুন (Framework: Other)। Environment Variables-এ `TWELVE_DATA_API_KEY` দিন।
4. GitHub → Actions → `scan` → **Run workflow** চালিয়ে প্রথম স্ক্যান নিন। commit হলে Vercel নিজে redeploy করবে।

লোকালি টেস্ট: `npm test` (নেটওয়ার্ক ছাড়া), `node scripts/scan.js` (নেটওয়ার্ক লাগে)।

## নিজের স্ট্র্যাটেজি বসানো

`core/strategy.js`-এর `findSignals()` বদলান (CHoCH, order block ইত্যাদি)। শুধু এই আউটপুট ফরম্যাট ঠিক রাখুন: `{ side, i, t, entry, risk, rr, sl, tp }`। Time Machine, scanner, history সব নিজে থেকে কাজ করবে।

## জেনে রাখুন

- সিমুলেশন ফলাফল ঐতিহাসিক সম্ভাবনা, ভবিষ্যদ্বাণী নয়। একই বারে SL ও TP দুটোই লাগলে SL ধরা হয়।
- ফ্রি Twelve Data: মিনিটে ৮ রিকোয়েস্ট, তাই scanner forex-এ ৮ সেকেন্ড বিরতি দেয়। `/api/timemachine` পাবলিক থাকলে অন্যরা আপনার কোটা খরচ করতে পারে, তাই চাইলে Vercel-এ password protection দিন।
- Forex লট হিসাব USD-quoted pair-এ নির্ভুল; USD/JPY-তে ইউনিট quote currency-তে আসে।
- Vercel Hobby-তে deploy সীমা আছে; ঘণ্টায় একবার স্ক্যান নিরাপদ।
