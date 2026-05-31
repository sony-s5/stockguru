// lib/buildSteps.ts
export function buildSteps(m: any = {}) {

  // ── Helpers ──────────────────────────────────────────────
  function status(condition: boolean, failStatus: 'FAIL' | 'CAUTION' = 'CAUTION') {
    return condition ? 'PASS' : failStatus
  }

  // Overall score calculation
  const checks = [
    m.revenueGrowth    > 10,
    m.roe              > 15,
    m.promoterHolding  > 40 && m.pledge === 0,
    m.debtToEquity     < 1,
    m.roce             > 15,
    m.roe              > 15 && m.debtToEquity < 0.5,
    m.salesGrowth3yr   > 8,
    m.pe               < 30,
    m.freeCashFlow     > 0,
    m.currentRatio     > 1,
  ]
  const passCount    = checks.filter(Boolean).length
  const overallScore = Math.round(50 + (passCount / checks.length) * 50)

  // Verdict
  const verdict =
    overallScore >= 75 ? 'Buy' :
    overallScore >= 60 ? 'Accumulate' :
    overallScore >= 45 ? 'Hold' :
    overallScore >= 30 ? 'Caution' : 'Avoid'

  // 52-week position
  const range52 = m.high52 - m.low52
  const pricePosition = range52 > 0
    ? Math.round(((m.currentPrice - m.low52) / range52) * 100)
    : 50

  return {
    overallScore,
    verdict,
    steps: [

      // ── Step 1: Industry Check ──────────────────────────
      {
        num: 1,
        name: 'Industry Check',
        status:
          m.revenueGrowth > 15 ? 'PASS' :
          m.revenueGrowth > 8  ? 'CAUTION' : 'FAIL',
        detail:
          m.revenueGrowth > 0
            ? `${m.companyName} revenue grew ${m.revenueGrowth}% YoY. ` +
              (m.salesGrowth3yr > 0
                ? `3-year sales CAGR is ${m.salesGrowth3yr}%, indicating ${m.salesGrowth3yr > 10 ? 'strong' : 'moderate'} industry demand.`
                : `Sector performance needs monitoring.`)
            : `Revenue growth data unavailable. Verify on Screener.in.`
      },

      // ── Step 2: Business Quality (Moat) ────────────────
      {
        num: 2,
        name: 'Business Quality (Moat)',
        status:
          m.roe > 20 && m.roce > 20 ? 'PASS' :
          m.roe > 12               ? 'CAUTION' : 'FAIL',
        detail:
          m.roe > 0
            ? `ROE ${m.roe}%, ROCE ${m.roce}%. ` +
              (m.operatingMargin > 0
                ? `Operating margin ${m.operatingMargin}%, net margin ${m.netProfitMargin}%. ` +
                  (m.roe > 20 ? 'Strong moat with pricing power.' : 'Moderate competitive position.')
                : 'Margin data unavailable.')
            : `Profitability data unavailable.`
      },

      // ── Step 3: Promoter Check ──────────────────────────
{
  num: 3,
  name: 'Promoter Check',
  status:
    m.promoterHolding === null                           ? 'CAUTION' :
    m.promoterHolding > 50 && m.pledge === 0             ? 'PASS' :
    m.promoterHolding > 25 && (m.pledge ?? 0) < 10      ? 'CAUTION' : 'FAIL',
  detail:
    m.promoterHolding !== null
      ? `Promoter holding ${m.promoterHolding}%, pledge ${m.pledge ?? 0}%. ` +
        `FII ${m.fiiHolding ?? 0}%, DII ${m.diiHolding ?? 0}%. ` +
        (m.pledge > 10
          ? `⚠️ High pledge ${m.pledge}% is a red flag.`
          : m.promoterHolding > 50
          ? 'Strong promoter confidence.'
          : m.promoterHolding > 25
          ? 'Moderate promoter stake — acceptable for large-cap MNCs.'
          : 'Low promoter holding — verify institutional support.')
      : `Ownership data unavailable. Verify on Screener.in.`
},

      // ── Step 4: Risk Check ──────────────────────────────
{
  num: 4,
  name: 'Risk Check',
  status:
    m.debtToEquity === null && m.freeCashFlow > 0  ? 'PASS' :
    m.debtToEquity === null                         ? 'CAUTION' :
    m.debtToEquity < 0.5 && m.currentRatio > 1.5   ? 'PASS' :
    m.debtToEquity < 1                              ? 'CAUTION' : 'FAIL',
  detail:
    m.debtToEquity !== null
      ? `Debt/Equity ${m.debtToEquity}x, Current ratio ${m.currentRatio ?? 'N/A'}x. ` +
        (m.interestCoverage > 0 ? `Interest coverage ${m.interestCoverage}x. ` : '') +
        (m.debtToEquity > 1
          ? '⚠️ High leverage increases financial risk.'
          : m.debtToEquity < 0.3
          ? 'Very low debt — strong balance sheet.'
          : 'Manageable debt levels.')
      : m.freeCashFlow > 0
      ? `Debt data unavailable but FCF ₹${m.freeCashFlow}Cr positive — likely low debt company.`
      : `Debt data unavailable. Verify on Screener.in.`
},

      // ── Step 5: Management Quality ──────────────────────
      {
        num: 5,
        name: 'Management Quality',
        status:
          m.roce > 18 && m.profitGrowth > 10 ? 'PASS' :
          m.roce > 12                         ? 'CAUTION' : 'FAIL',
        detail:
          m.roce > 0
            ? `ROCE ${m.roce}% shows capital allocation efficiency. ` +
              (m.profitGrowth > 0
                ? `Net profit grew ${m.profitGrowth}% YoY. `
                : '') +
              (m.profitGrowth3yr > 0
                ? `3-year profit CAGR ${m.profitGrowth3yr}%. ` +
                  (m.profitGrowth3yr > 15
                    ? 'Management consistently delivering growth.'
                    : 'Moderate execution track record.')
                : '')
            : `Management performance data unavailable.`
      },

      // ── Step 6: Financial Strength ──────────────────────
      {
        num: 6,
        name: 'Financial Strength',
        status:
          m.roe > 15 && m.debtToEquity < 0.5 && m.freeCashFlow > 0 ? 'PASS' :
          m.roe > 10 && m.debtToEquity < 1                          ? 'CAUTION' : 'FAIL',
        detail:
          m.roe > 0
            ? `ROE ${m.roe}%, D/E ${m.debtToEquity}x. ` +
              (m.freeCashFlow !== 0
                ? `FCF ₹${m.freeCashFlow}Cr — ${m.freeCashFlow > 0 ? 'positive, company generates cash.' : '⚠️ negative FCF.'} `
                : '') +
              (m.revenueGrowth > 0
                ? `Revenue growth ${m.revenueGrowth}% YoY.`
                : '')
            : `Financial data unavailable.`
      },

      // ── Step 7: Consistency Check ───────────────────────
      {
        num: 7,
        name: 'Consistency Check',
        status:
          m.salesGrowth3yr > 12 && m.profitGrowth3yr > 12 ? 'PASS' :
          m.salesGrowth3yr > 6  && m.profitGrowth3yr > 6  ? 'CAUTION' : 'FAIL',
        detail:
          m.salesGrowth3yr > 0 || m.profitGrowth3yr > 0
            ? `3-year Sales CAGR ${m.salesGrowth3yr}%, Profit CAGR ${m.profitGrowth3yr}%. ` +
              (m.dividendYield > 0
                ? `Dividend yield ${m.dividendYield}% shows shareholder returns. `
                : '') +
              (m.salesGrowth3yr > 12
                ? 'Consistent growth track record.'
                : 'Growth consistency needs monitoring.')
            : `Historical growth data unavailable.`
      },

      // ── Step 8: Valuation ───────────────────────────────
      {
        num: 8,
        name: 'Valuation',
        status:
          m.pe > 0 && m.pe < 20 ? 'PASS' :
          m.pe > 0 && m.pe < 35 ? 'WAIT' : 'CAUTION',
        detail:
          m.pe > 0
            ? `PE ${m.pe}x, PB ${m.pb}x. ` +
              (m.evEbitda > 0 ? `EV/EBITDA ${m.evEbitda}x. ` : '') +
              (m.eps > 0 ? `EPS ₹${m.eps}. ` : '') +
              (m.pe < 20
                ? 'Attractively valued — potential upside.'
                : m.pe < 35
                ? 'Fairly to slightly premium valued — wait for dip.'
                : '⚠️ High valuation — enter only on significant correction.')
            : `Valuation data unavailable.`
      },

      // ── Step 9: Entry Strategy ──────────────────────────
      {
        num: 9,
        name: 'Entry Strategy',
        status: pricePosition < 40 ? 'PASS' : pricePosition < 70 ? 'CAUTION' : 'WAIT',
        detail:
          m.currentPrice > 0
            ? `CMP ₹${m.currentPrice}. ` +
              (m.high52 > 0 && m.low52 > 0
                ? `52W range ₹${m.low52}–₹${m.high52} (currently at ${pricePosition}% of range). `
                : '') +
              (pricePosition < 40
                ? 'Near 52W low — good entry zone.'
                : pricePosition < 70
                ? 'Mid-range — accumulate in small tranches.'
                : '⚠️ Near 52W high — wait for pullback before entering.')
            : `Price data unavailable.`
      },

      // ── Step 10: Position Sizing ────────────────────────
      {
        num: 10,
        name: 'Position Sizing',
        status: 'PASS',
        detail:
          (() => {
            const risk =
              m.debtToEquity > 1 || m.pledge > 10 ? 'high-risk' :
              m.roe < 12 || m.revenueGrowth < 5   ? 'moderate-risk' : 'low-risk'
            const alloc =
              risk === 'high-risk'     ? '2–3%' :
              risk === 'moderate-risk' ? '4–6%' : '7–10%'
            return `${risk === 'high-risk' ? '⚠️ High-risk stock' : risk === 'moderate-risk' ? 'Moderate-risk stock' : 'Low-risk stock'} — suggested allocation ${alloc} of portfolio. ` +
              `${m.currentPrice > 0 ? `Start with 50% at CMP ₹${m.currentPrice}, add on dips.` : 'Invest in 2–3 tranches to average cost.'}`
          })()
      },

      // ── Step 11: Holding Strategy ───────────────────────
      {
        num: 11,
        name: 'Holding Strategy',
        status: 'PASS',
        detail:
          (() => {
            const horizon =
              m.salesGrowth3yr > 15 && m.roe > 20 ? '3–5 years' :
              m.salesGrowth3yr > 8                 ? '2–3 years' : '1–2 years'
            return `Recommended holding: ${horizon}. ` +
              (m.revenueGrowth > 10
                ? `Strong revenue growth ${m.revenueGrowth}% supports long-term compounding. `
                : '') +
              (m.dividendYield > 1
                ? `Dividend yield ${m.dividendYield}% provides income while holding. `
                : '') +
              'Review quarterly results for growth trajectory.'
          })()
      },

      // ── Step 12: Exit Rules ─────────────────────────────
      {
        num: 12,
        name: 'Exit Rules',
        status: 'CAUTION',
        detail:
          `Exit triggers: ` +
          (m.pe > 0      ? `PE crosses ${Math.round(m.pe * 1.5)}x (1.5x current). ` : '') +
          (m.debtToEquity >= 0 ? `D/E rises above ${(m.debtToEquity + 0.5).toFixed(1)}x. ` : '') +
          (m.promoterHolding > 0 ? `Promoter holding drops below ${Math.round(m.promoterHolding * 0.85)}%. ` : '') +
          (m.revenueGrowth > 0 ? `Revenue growth falls below ${Math.max(5, Math.round(m.revenueGrowth * 0.5))}% for 2 consecutive quarters. ` : '') +
          `Stop loss: 15–20% below entry price.`
      },

    ]
  }
}