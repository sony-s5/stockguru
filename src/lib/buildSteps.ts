// lib/buildSteps.ts
// ─────────────────────────────────────────────────────────────────────────────
// Improved: smarter null handling, better verdicts, richer context for AI
// ─────────────────────────────────────────────────────────────────────────────

export function buildSteps(m: any = {}) {

  // ── Scoring: only count checks where data is available ──────────────────
  interface Check { pass: boolean; available: boolean }

  function check(condition: boolean | null, available = true): Check {
    if (!available || condition === null) return { pass: false, available: false }
    return { pass: condition, available: true }
  }

  const checks: Check[] = [
    check(m.revenueGrowth   !== null && m.revenueGrowth   > 10,  m.revenueGrowth   !== null),
    check(m.roe             !== null && m.roe             > 15,   m.roe             !== null),
    check(m.promoterHolding !== null && m.promoterHolding > 40 && m.pledge === 0, m.promoterHolding !== null),
    check(m.debtToEquity    !== null && m.debtToEquity    < 1,    m.debtToEquity    !== null),
    check(m.roce            !== null && m.roce            > 15,   m.roce            !== null),
    check(m.roe             !== null && m.debtToEquity    !== null && m.roe > 15 && m.debtToEquity < 0.5,
          m.roe !== null && m.debtToEquity !== null),
    check(m.salesGrowth3yr  !== null && m.salesGrowth3yr  > 8,   m.salesGrowth3yr  !== null),
    check(m.pe              !== null && m.pe              < 30,   m.pe              !== null),
    check(m.freeCashFlow    !== null && m.freeCashFlow    > 0,    m.freeCashFlow    !== null),
    check(m.currentRatio    !== null && m.currentRatio    > 1,    m.currentRatio    !== null),
    check(m.opm             !== null && m.opm             > 15,   m.opm             !== null),
    check(m.netProfitMargin !== null && m.netProfitMargin > 10,   m.netProfitMargin !== null),
  ]

  // Score only based on available checks (avoid penalising for missing data)
  const available = checks.filter(c => c.available)
  const passed    = available.filter(c => c.pass)

  // If < 4 data points available, cap score at 60 (insufficient data)
  const dataConfidence = available.length >= 8 ? 1 : available.length >= 5 ? 0.85 : 0.7
  const rawScore = available.length > 0
    ? Math.round(50 + (passed.length / available.length) * 50)
    : 50
  const overallScore = Math.round(rawScore * dataConfidence)

  const verdict =
    overallScore >= 75 ? 'Buy' :
    overallScore >= 62 ? 'Accumulate' :
    overallScore >= 50 ? 'Hold' :
    overallScore >= 35 ? 'Caution' : 'Avoid'

  // 52-week position
  const range52 = (m.high52 ?? 0) - (m.low52 ?? 0)
  const pricePosition = range52 > 0 && m.currentPrice
    ? Math.round(((m.currentPrice - m.low52) / range52) * 100)
    : 50

  return {
    overallScore,
    verdict,
    steps: [

      // ── Step 1: Industry Check ──────────────────────────────────────────
      {
        num: 1,
        name: 'Industry Check',
        status:
          m.revenueGrowth === null ? 'CAUTION' :
          m.revenueGrowth > 15     ? 'PASS' :
          m.revenueGrowth > 8      ? 'CAUTION' : 'FAIL',
        detail:
          m.revenueGrowth !== null
            ? `Revenue grew ${m.revenueGrowth}% YoY. ` +
              (m.salesGrowth3yr !== null
                ? `3-year CAGR ${m.salesGrowth3yr}% — ` +
                  (m.salesGrowth3yr > 12 ? 'strong sustained demand.' :
                   m.salesGrowth3yr > 7  ? 'moderate industry growth.' :
                   'slowing growth trend.')
                : 'Long-term CAGR data unavailable — check Screener for historical trends.')
            : m.sector !== null
            ? `Revenue growth data not available for ${m.sector} sector. Verify TTM numbers on Screener.in.`
            : 'Revenue growth data unavailable. Verify on Screener.in.',
        verifyLinks: [
          { label: 'Screener → Quarterly Results', url: `https://www.screener.in/company/${m.ticker}/` },
        ],
      },

      // ── Step 2: Business Quality (Moat) ────────────────────────────────
      {
        num: 2,
        name: 'Business Quality (Moat)',
        status:
          m.roe === null              ? 'CAUTION' :
          m.roe > 20 && m.roce > 20  ? 'PASS' :
          m.roe > 12                  ? 'CAUTION' : 'FAIL',
        detail:
          m.roe !== null
            ? `ROE ${m.roe}%, ROCE ${m.roce !== null ? m.roce + '%' : 'N/A'}. ` +
              (m.opm !== null
                ? `OPM ${m.opm}%, Net Margin ${m.netProfitMargin !== null ? m.netProfitMargin + '%' : 'N/A'}. ` +
                  (m.roe > 20 && m.opm > 20
                    ? 'Strong moat — pricing power and high returns indicate competitive advantage.'
                    : m.roe > 15
                    ? 'Good returns. Moat present but needs monitoring vs competitors.'
                    : 'Returns are adequate but moat is unclear.')
                : 'Margin data unavailable. ' +
                  (m.roe > 20 ? 'High ROE suggests strong business quality.' : 'Verify OPM and margins on Screener.'))
            : 'Profitability data unavailable. Verify ROE and ROCE on Screener.in.',
        checklistItems:
          m.roe === null ? [
            'ROE > 15%?',
            'ROCE > 15%?',
            'OPM stable or expanding?',
            'Net Margin > 10%?',
          ] : undefined,
        verifyLinks: m.roe === null ? [
          { label: `Screener.in → ${m.companyName} Ratios`, url: `https://www.screener.in/company/${m.ticker}/` },
        ] : undefined,
      },

      // ── Step 3: Promoter Check ──────────────────────────────────────────
      {
        num: 3,
        name: 'Promoter Check',
        status:
          m.promoterHolding === null             ? 'CAUTION' :
          m.pledge > 10                          ? 'FAIL' :
          m.promoterHolding > 50 && m.pledge === 0 ? 'PASS' :
          m.promoterHolding > 20                 ? 'CAUTION' : 'CAUTION',
        detail:
          m.promoterHolding !== null
            ? `Promoter holding ${m.promoterHolding}%, pledge ${m.pledge ?? 0}%. ` +
              (m.pledge > 10
                ? `⚠️ Pledge ${m.pledge}% is a red flag — promoters have borrowed against shares.`
                : m.promoterHolding > 60
                ? 'Strong promoter confidence with low pledge. Positive signal.'
                : m.promoterHolding > 40
                ? 'Adequate promoter holding. Verify if increasing or decreasing trend.'
                : m.promoterHolding > 20
                ? 'MNC/large-cap — low promoter holding is normal. Check FII/DII institutional ownership.'
                : 'Very low promoter holding — assess institutional support and governance quality.')
            : 'Promoter data not parsed. Verify on Screener.in shareholding section.',
        checklistItems: [
          'Promoter holding > 40%?',
          'Pledge % = 0% (10%+ is red flag)',
          'Promoter stake increasing or decreasing?',
        ],
        verifyLinks: [
          { label: 'Screener.in → Shareholding Pattern', url: `https://www.screener.in/company/${m.ticker}/#shareholding` },
        ],
      },

      // ── Step 4: Risk Check ──────────────────────────────────────────────
      {
        num: 4,
        name: 'Risk Check',
        status:
          m.debtToEquity === null                            ? 'CAUTION' :
          m.debtToEquity === 0                               ? 'PASS' :
          m.debtToEquity < 0.5 && (m.currentRatio ?? 0) > 1.5 ? 'PASS' :
          m.debtToEquity < 1                                 ? 'CAUTION' : 'FAIL',
        detail:
          m.debtToEquity !== null
            ? (m.debtToEquity === 0
                ? 'Debt-free company — very strong balance sheet. ' :
                `Debt/Equity ${m.debtToEquity}x. `) +
              (m.currentRatio !== null ? `Current ratio ${m.currentRatio}x. ` : '') +
              (m.interestCoverage !== null ? `Interest coverage ${m.interestCoverage}x. ` : '') +
              (m.debtToEquity > 1
                ? '⚠️ High leverage increases financial risk. Review debt repayment schedule.'
                : m.debtToEquity === 0 || m.debtToEquity < 0.3
                ? 'Negligible debt — no financial risk from leverage.'
                : 'Manageable debt levels.')
            : 'Debt data unavailable — company may be debt-free. Verify on Screener.in balance sheet.',
        checklistItems: m.debtToEquity === null ? [
          'Debt to Equity < 0.5?',
          'Current Ratio > 1.5?',
          'Interest Coverage > 3x?',
        ] : undefined,
        verifyLinks: m.debtToEquity === null ? [
          { label: 'Screener.in → Balance Sheet', url: `https://www.screener.in/company/${m.ticker}/#balance-sheet` },
        ] : undefined,
      },

      // ── Step 5: Management Quality ──────────────────────────────────────
      {
        num: 5,
        name: 'Management Quality',
        status:
          m.roce === null                          ? 'CAUTION' :
          m.roce > 20 && m.profitGrowth > 12      ? 'PASS' :
          m.roce > 15 && m.profitGrowth > 8       ? 'PASS' :
          m.roce > 12                              ? 'CAUTION' : 'FAIL',
        detail:
          m.roce !== null
            ? `ROCE ${m.roce}% indicates capital allocation efficiency. ` +
              (m.profitGrowth !== null
                ? `Net profit grew ${m.profitGrowth}% YoY. ` : '') +
              (m.profitGrowth3yr !== null
                ? `3-year profit CAGR ${m.profitGrowth3yr}%. ` +
                  (m.profitGrowth3yr > 18 ? 'Excellent execution — management consistently delivers growth.' :
                   m.profitGrowth3yr > 10 ? 'Solid track record of profitable growth.' :
                   'Moderate execution — watch for margin improvement signals.')
                : 'Track 3-year profit CAGR for long-term management quality assessment.')
            : 'Management performance data unavailable.',
      },

      // ── Step 6: Financial Strength ──────────────────────────────────────
      {
        num: 6,
        name: 'Financial Strength',
        status:
          m.roe === null                                                  ? 'CAUTION' :
          m.roe > 15 && (m.debtToEquity ?? 99) < 0.5 && m.freeCashFlow > 0 ? 'PASS' :
          m.roe > 10 && (m.debtToEquity ?? 99) < 1                       ? 'CAUTION' : 'FAIL',
        detail:
          m.roe !== null
            ? `ROE ${m.roe}%, D/E ${m.debtToEquity !== null ? m.debtToEquity + 'x' : 'N/A'}. ` +
              (m.freeCashFlow !== null
                ? `FCF ₹${m.freeCashFlow} Cr — ${m.freeCashFlow > 0 ? 'positive, company generates surplus cash.' : '⚠️ negative FCF is a red flag.'} `
                : 'FCF data not available. ') +
              (m.revenueGrowth !== null ? `Revenue growth ${m.revenueGrowth}% YoY.` : '')
            : 'Financial data unavailable.',
        checklistItems: m.freeCashFlow === null ? [
          'ROE > 15%?',
          'Revenue growing YoY?',
          'Net Profit growing YoY?',
          'Debt to Equity < 0.5?',
          'Free Cash Flow positive?',
        ] : undefined,
        verifyLinks: m.freeCashFlow === null ? [
          { label: 'Screener.in → Key Metrics + Quarterly Results', url: `https://www.screener.in/company/${m.ticker}/` },
        ] : undefined,
      },

      // ── Step 7: Consistency Check ───────────────────────────────────────
      {
        num: 7,
        name: 'Consistency Check',
        status:
          (m.salesGrowth3yr === null && m.profitGrowth3yr === null) ? 'CAUTION' :
          (m.salesGrowth3yr ?? 0) > 12 && (m.profitGrowth3yr ?? 0) > 12 ? 'PASS' :
          (m.salesGrowth3yr ?? 0) > 6  && (m.profitGrowth3yr ?? 0) > 6  ? 'CAUTION' : 'FAIL',
        detail:
          (m.salesGrowth3yr !== null || m.profitGrowth3yr !== null)
            ? `3-year Sales CAGR ${m.salesGrowth3yr !== null ? m.salesGrowth3yr + '%' : 'N/A'}, Profit CAGR ${m.profitGrowth3yr !== null ? m.profitGrowth3yr + '%' : 'N/A'}. ` +
              (m.dividendYield !== null && m.dividendYield > 0
                ? `Dividend yield ${m.dividendYield}% — consistent shareholder returns. ` : '') +
              ((m.salesGrowth3yr ?? 0) > 12
                ? 'Consistent compounding growth track record.' :
               (m.salesGrowth3yr ?? 0) > 6
                ? 'Moderate consistency — track if growth rate is accelerating or decelerating.'
                : 'Growth consistency below threshold — needs monitoring.')
            : 'Historical 3-year CAGR data unavailable.',
      },

      // ── Step 8: Valuation ───────────────────────────────────────────────
      {
        num: 8,
        name: 'Valuation',
        status:
          m.pe === null                                       ? 'CAUTION' :
          m.pe < 15                                           ? 'PASS' :
          m.pe < (m.industryPe !== null ? m.industryPe : 30) ? 'CAUTION' :
          m.pe < 40                                           ? 'WAIT' : 'FAIL',
        detail:
          m.pe !== null
            ? `PE ${m.pe}x` +
              (m.industryPe !== null ? ` vs Industry PE ${m.industryPe}x.` : '.') +
              (m.pb !== null ? ` P/B ${m.pb}x.` : '') +
              (m.eps !== null ? ` EPS ₹${m.eps}.` : '') +
              (m.pe < 15
                ? ' Attractively valued — potential value pick.'
                : m.industryPe !== null && m.pe < m.industryPe
                ? ' Trading below industry average PE — relative value opportunity.'
                : m.pe < 30
                ? ' Fairly valued. Enter only on dips for better margin of safety.'
                : m.pe < 45
                ? ' Premium valuation. Growth must sustain to justify price.'
                : ' ⚠️ High valuation — enter only on significant correction or if growth is exceptional.')
            : 'PE data unavailable.',
      },

      // ── Step 9: Entry Strategy ──────────────────────────────────────────
      {
        num: 9,
        name: 'Entry Strategy',
        status:
          pricePosition < 35  ? 'PASS' :
          pricePosition < 65  ? 'CAUTION' : 'WAIT',
        detail:
          m.currentPrice !== null
            ? `CMP ₹${m.currentPrice}. ` +
              (m.high52 !== null && m.low52 !== null
                ? `52W range ₹${m.low52}–₹${m.high52} (at ${pricePosition}% of range). ` : '') +
              (pricePosition < 35
                ? 'Near 52W low — attractive entry zone with good risk-reward.'
                : pricePosition < 65
                ? 'Mid-range — accumulate in 2–3 tranches to average cost.'
                : '⚠️ Near 52W high — wait for 10–15% pullback before entering.')
            : 'Price data unavailable.',
      },

      // ── Step 10: Position Sizing ────────────────────────────────────────
      {
        num: 10,
        name: 'Position Sizing',
        status: 'PASS',
        detail: (() => {
          const isHighRisk   = (m.debtToEquity ?? 0) > 1 || (m.pledge ?? 0) > 10
          const isMediumRisk = !isHighRisk && ((m.roe ?? 15) < 12 || (m.revenueGrowth ?? 10) < 5)
          const risk  = isHighRisk ? 'high-risk' : isMediumRisk ? 'moderate-risk' : 'low-risk'
          const alloc = risk === 'high-risk' ? '2–3%' : risk === 'moderate-risk' ? '4–6%' : '7–10%'
          return `${risk === 'high-risk' ? '⚠️ High-risk' : risk === 'moderate-risk' ? 'Moderate-risk' : 'Low-risk'} stock — suggested allocation ${alloc} of total portfolio. ` +
            (m.currentPrice !== null
              ? `Start with 50% position at CMP ₹${m.currentPrice}, add on dips.`
              : 'Invest in 2–3 tranches to average cost effectively.')
        })(),
      },

      // ── Step 11: Holding Strategy ───────────────────────────────────────
      {
        num: 11,
        name: 'Holding Strategy',
        status: 'PASS',
        detail: (() => {
          const horizon =
            (m.salesGrowth3yr ?? 0) > 15 && (m.roe ?? 0) > 20 ? '3–5 years' :
            (m.salesGrowth3yr ?? 0) > 8                         ? '2–3 years' : '1–2 years'
          return `Recommended holding: ${horizon}. ` +
            (m.revenueGrowth !== null && m.revenueGrowth > 10
              ? `Revenue growth ${m.revenueGrowth}% supports long-term compounding. ` : '') +
            (m.dividendYield !== null && m.dividendYield > 1
              ? `Dividend yield ${m.dividendYield}% provides income during hold. ` : '') +
            'Review quarterly results for growth trajectory changes.'
        })(),
      },

      // ── Step 12: Exit Rules ─────────────────────────────────────────────
      {
        num: 12,
        name: 'Exit Rules',
        status: 'CAUTION',
        detail: [
          m.pe              !== null ? `PE crosses ${Math.round(m.pe * 1.6)}x (1.6x current ${m.pe}x).` : null,
          m.debtToEquity    !== null ? `D/E rises above ${parseFloat((m.debtToEquity + 0.5).toFixed(1))}x.` : null,
          m.promoterHolding !== null ? `Promoter holding drops below ${Math.round(m.promoterHolding * 0.85)}%.` : null,
          m.revenueGrowth   !== null ? `Revenue growth falls below ${Math.max(5, Math.round(m.revenueGrowth * 0.5))}% for 2 consecutive quarters.` : null,
          'Stop loss: 15–20% below entry price.',
          'Review thesis if sector dynamics change significantly.',
        ].filter(Boolean).join(' '),
      },
    ],
  }
}