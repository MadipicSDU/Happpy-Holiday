export const cancellationConfirmation = (quote, reason = '') => {
  if (!quote || !Number.isInteger(quote.revision) || ![quote.penaltyAmount, quote.refundAmount, quote.amountDue].every(value => Number.isFinite(value) && value >= 0))
    throw new Error('Review a valid cancellation quote before confirming.');
  return { expectedRevision: quote.revision, expectedPenalty: quote.penaltyAmount, expectedRefund: quote.refundAmount,
    expectedAmountDue: quote.amountDue, reason: reason.trim() };
};
export const canReview = order => order?.status === 'completed' && Boolean(order.paymentConfirmedAt) && order.paidAmount >= order.totalAmount;
export function halfYearPeriod(year, half) {
  if (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2100 || ![1, 2].includes(Number(half))) throw new Error('Choose a valid year and half-year.');
  const from = new Date(Date.UTC(Number(year), Number(half) === 1 ? 0 : 6, 1));
  const to = new Date(Date.UTC(Number(year), Number(half) === 1 ? 6 : 12, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}
