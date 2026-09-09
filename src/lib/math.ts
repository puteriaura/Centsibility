export function calculateInvestmentGrowth(
  principal: number,
  rate: number,
  weeks: number,
  randomFn: () => number = Math.random,
) {
  if (weeks <= 0 || principal <= 0 || rate <= 0) return { grown: principal, gain: 0 };

  let minReturn = 0;
  let maxReturn = rate;
  if (rate === 0.001) {
    minReturn = -0.01;
    maxReturn = 0.03;
  } // Low
  else if (rate === 0.002) {
    minReturn = -0.05;
    maxReturn = 0.08;
  } // Medium
  else if (rate === 0.003) {
    minReturn = -0.15;
    maxReturn = 0.2;
  } // High
  else if (rate === 0.004) {
    minReturn = -0.3;
    maxReturn = 0.5;
  } // Very High

  let grown = principal;
  for (let i = 0; i < weeks; i++) {
    const weeklyRate = minReturn + randomFn() * (maxReturn - minReturn);
    grown = grown * (1 + weeklyRate);
  }

  // Ensure it doesn't go below 0 and prevent absurd runaway compounding
  grown = Math.max(0, Math.min(grown, principal * 2));
  return { grown, gain: grown - principal };
}

export function calculateLoanRepayment(
  loanAmount: number,
  currentRepaid: number,
  paymentAmount: number,
) {
  const newRepaid = Math.min(loanAmount, currentRepaid + paymentAmount);
  // EPSILON tolerance for floating point inaccuracy so loans don't get stuck at 99.999% repaid
  const fullyRepaid = Math.abs(loanAmount - newRepaid) < 0.001;
  return { newRepaid, fullyRepaid };
}

export const DEFAULT_NISAB = 22000;
export const DEFAULT_ZAKAT_RATE = 0.025;

export function calculateZakat(
  netWealth: number,
  nisab: number = DEFAULT_NISAB,
  zakatRate: number = DEFAULT_ZAKAT_RATE,
): number {
  const aboveNisab = netWealth >= nisab;
  return aboveNisab ? netWealth * zakatRate : 0;
}

