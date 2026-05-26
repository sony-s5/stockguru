export function buildSteps(metrics: any = {}) {

  return [

    // STEP 1
    {
      num: 1,
      name: 'Industry Check',

      status:
        metrics.revenueGrowth > 10
          ? 'PASS'
          : 'CAUTION',

      detail:
        `Revenue growth is ${metrics.revenueGrowth}%`
    },

    // STEP 2
    {
      num: 2,
      name: 'Business Quality (Moat)',

      status:
        metrics.roe > 20
          ? 'PASS'
          : 'CAUTION',

      detail:
        `Company has ROE of ${metrics.roe}% indicating decent business quality`
    },

    // STEP 3
    {
      num: 3,
      name: 'Promoter Check',

      status:
        metrics.promoterHolding > 40 &&
        metrics.pledge === 0
          ? 'PASS'
          : 'CAUTION',

      detail:
        `Promoter holding is ${metrics.promoterHolding}% and pledge is ${metrics.pledge}%`
    },

    // STEP 4
    {
      num: 4,
      name: 'Risk Check',

      status:
        metrics.debtToEquity < 1
          ? 'PASS'
          : 'CAUTION',

      detail:
        `Debt/Equity ratio is ${metrics.debtToEquity}`
    },

    // STEP 5
    {
      num: 5,
      name: 'Management Quality',

      status:
        metrics.promoterHolding > 30
          ? 'PASS'
          : 'CAUTION',

      detail:
        `Promoter holding is ${metrics.promoterHolding}%`
    },

    // STEP 6
    {
      num: 6,
      name: 'Financial Strength',

      status:
        metrics.roe > 15 &&
        metrics.debtToEquity < 0.5
          ? 'PASS'
          : 'CAUTION',

      detail:
        `ROE is ${metrics.roe}% and Debt/Equity is ${metrics.debtToEquity}`
    },

    // STEP 7
    {
      num: 7,
      name: 'Consistency Check',

      status:
        metrics.revenueGrowth > 8
          ? 'PASS'
          : 'CAUTION',

      detail:
        `Revenue growth is ${metrics.revenueGrowth}%`
    },

    // STEP 8
    {
      num: 8,
      name: 'Valuation',

      status:
        metrics.pe < 25
          ? 'PASS'
          : 'WAIT',

      detail:
        `PE ratio is ${metrics.pe} and PB ratio is ${metrics.pb}`
    },

    // STEP 9
    {
      num: 9,
      name: 'Entry Strategy',

      status: 'PASS',

      detail:
        `Current market price is ₹${metrics.currentPrice}`
    },

    // STEP 10
    {
      num: 10,
      name: 'Position Sizing',

      status: 'PASS',

      detail:
        `Suggested allocation is 5% to 10% of portfolio`
    },

    // STEP 11
    {
      num: 11,
      name: 'Holding Strategy',

      status: 'PASS',

      detail:
        `Long-term holding period of 3 to 5 years preferred`
    },

    // STEP 12
    {
      num: 12,
      name: 'Exit Rules',

      status: 'CAUTION',

      detail:
        `Exit if earnings growth weakens or debt rises significantly`
    }

  ]
}