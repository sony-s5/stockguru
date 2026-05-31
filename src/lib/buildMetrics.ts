// lib/buildMetrics.ts
export function buildMetrics(data: any = {}, yahoo: any = {}) {
  return {
    // Company Info
    companyName:      data?.name             ?? 'N/A',
    ticker:           data?.ticker           ?? 'N/A',
    sector:           data?.sector           ?? 'N/A',

    // Price
    currentPrice:     data?.currentPrice     ?? null,
    high52:           data?.high52Week       ?? null,
    low52:            data?.low52Week        ?? null,

    // Valuation
    pe:               data?.stockPE          ?? null,
    pb:               data?.priceToBook      ?? null,
    evEbitda:         data?.evToEbitda       ?? null,
    eps:              data?.eps              ?? null,
    dividendYield:    data?.dividendYield    ?? null,

    // Profitability
    roe:              data?.roe              ?? null,
    roce:             data?.roce             ?? null,
    netProfitMargin:  data?.netProfitMargin  ?? yahoo?.profitMargins    ?? null,
    operatingMargin:  data?.opm              ?? yahoo?.operatingMargins ?? null,

    // Growth
    revenueGrowth:    data?.salesGrowth      ?? yahoo?.revenueGrowth    ?? null,
    salesGrowth3yr:   data?.salesGrowth3yr   ?? null,
    profitGrowth:     data?.profitGrowth     ?? yahoo?.profitGrowth     ?? null,
    profitGrowth3yr:  data?.profitGrowth3yr  ?? null,

    // Balance Sheet
    debtToEquity:     data?.debtToEquity     ?? yahoo?.debtToEquity     ?? null,
    currentRatio:     data?.currentRatio     ?? yahoo?.currentRatio     ?? null,
    interestCoverage: data?.interestCoverage ?? null,
    freeCashFlow:     data?.freeCashFlow     ?? yahoo?.freeCashFlow      ?? null,

    // Market
    marketCap:        data?.marketCap        ?? null,

    // Ownership
    promoterHolding:  data?.promoterHolding  ?? null,
    pledge:           data?.pledge           ?? null,
    fiiHolding:       data?.fiiHolding       ?? null,
    diiHolding:       data?.diiHolding       ?? null,
  }
}