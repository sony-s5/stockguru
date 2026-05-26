export function buildMetrics(data: any = {}) {
  return {
    companyName: data?.name || 'N/A',

    ticker: data?.ticker || 'N/A',

    currentPrice: Number(data?.currentPrice || 0),

    pe: Number(data?.stockPE || 0),

    pb: Number(data?.priceToBook || 0),

    roe: Number(data?.roe || 0),

    debtToEquity: Number(data?.debtToEquity || 0),

    promoterHolding: Number(data?.promoterHolding || 0),

    fiiHolding: Number(data?.fiiHolding || 0),

    diiHolding: Number(data?.diiHolding || 0),

    revenueGrowth: Number(data?.salesGrowth || 0),

    pledge: Number(data?.pledge || 0),
  }
}

