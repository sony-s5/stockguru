
// lib/buildMetrics.ts
export function buildMetrics(data: any = {}) {
  return {
    // Company Info
    companyName:      data?.name             || 'N/A',
    ticker:           data?.ticker           || 'N/A',
    sector:           data?.sector           || 'N/A',

    // Price
    currentPrice:     Number(data?.currentPrice  || 0),
    high52:           Number(data?.high52Week     || 0),
    low52:            Number(data?.low52Week      || 0),

    // Valuation
    pe:               Number(data?.stockPE        || 0),
    pb:               Number(data?.priceToBook    || 0),
    evEbitda:         Number(data?.evToEbitda     || 0),
    eps:              Number(data?.eps            || 0),
    dividendYield:    Number(data?.dividendYield  || 0),

    // Profitability
    roe:              Number(data?.roe            || 0),
    roce:             Number(data?.roce           || 0),
    netProfitMargin:  Number(data?.netProfitMargin|| 0),
    operatingMargin:  Number(data?.opm            || 0),

    // Growth
    revenueGrowth:    Number(data?.salesGrowth    || 0),   // 1yr
    salesGrowth3yr:   Number(data?.salesGrowth3yr || 0),   // 3yr CAGR
    profitGrowth:     Number(data?.profitGrowth   || 0),   // 1yr
    profitGrowth3yr:  Number(data?.profitGrowth3yr|| 0),   // 3yr CAGR

    // Balance Sheet
    debtToEquity:     Number(data?.debtToEquity   || 0),
    currentRatio:     Number(data?.currentRatio   || 0),
    interestCoverage: Number(data?.interestCoverage || 0),
    freeCashFlow:     Number(data?.freeCashFlow   || 0),    // in Cr

    // Market
    marketCap:        Number(data?.marketCap      || 0),    // in Cr

    // Ownership
    promoterHolding:  Number(data?.promoterHolding|| 0),
    pledge:           Number(data?.pledge         || 0),
    fiiHolding:       Number(data?.fiiHolding     || 0),
    diiHolding:       Number(data?.diiHolding     || 0),
  }
}