// Risk Manager: পজিশন সাইজ + লিমিট চেক (ব্রাউজারে চলে)

export function positionSize({ capital, riskPct, entry, sl, market }) {
  const riskAmt = (capital * riskPct) / 100;
  const dist = Math.abs(entry - sl);
  if (!(dist > 0) || !(riskAmt > 0)) return null;
  const units = riskAmt / dist;
  return {
    riskAmt,
    units,
    // USD-quoted pair-এর জন্য নির্ভুল (EUR/USD, GBP/USD, AUD/USD, XAU/USD ≈ 100oz)
    lots: market === 'forex' ? units / 100000 : null,
    notional: units * entry,
  };
}

export function checkRisk({
  capital, riskPct, maxRiskPct = 2, dailyLossLimitPct = 3,
  dayPnl = 0, maxTradesPerDay = 5, tradesToday = 0, rr = 2, minRR = 1.5,
}) {
  const reasons = [];
  if (riskPct > maxRiskPct) reasons.push(`প্রতি ট্রেডে ঝুঁকি ${riskPct}% > সীমা ${maxRiskPct}%`);
  const lossToday = Math.max(0, -dayPnl);
  const budgetLeft = (capital * dailyLossLimitPct) / 100 - lossToday;
  if (budgetLeft <= 0) reasons.push(`দৈনিক loss limit (${dailyLossLimitPct}%) শেষ`);
  else if ((capital * riskPct) / 100 > budgetLeft) reasons.push('এই ট্রেডের ঝুঁকি আজকের বাকি loss budget-এর বেশি');
  if (tradesToday >= maxTradesPerDay) reasons.push(`আজকের ট্রেড সীমা (${maxTradesPerDay}) শেষ`);
  if (rr < minRR) reasons.push(`RR ${rr} < ন্যূনতম ${minRR}`);
  return { ok: reasons.length === 0, reasons };
}
