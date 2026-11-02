export const DEMO_CARDS = [
  { outcome: 'success', number: '4242424242424242', label: 'Successful test card' },
  { outcome: 'declined', number: '4000000000000002', label: 'Declined test card' },
];

export const formatDemoCardNumber = value => String(value).replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
export const formatDemoExpiry = value => {
  const digits = String(value).replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

export function demoCardExample(outcome, now = new Date()) {
  const card = DEMO_CARDS.find(card => card.outcome === outcome);
  return { cardholderName: 'Alex Demo', cardNumber: formatDemoCardNumber(card.number),
    expiry: `${String(now.getMonth() + 1).padStart(2, '0')}/${String((now.getFullYear() + 1) % 100).padStart(2, '0')}`,
    securityCode: '123' };
}

export function validateDemoPayment(details, now = new Date()) {
  const errors = {};
  const name = details.cardholderName.trim();
  if (name.length < 2 || name.length > 100) errors.cardholderName = 'Enter a cardholder name between 2 and 100 characters.';
  const card = DEMO_CARDS.find(card => card.number === details.cardNumber.replace(/[ -]/g, ''));
  if (!card) errors.cardNumber = 'Use one of the supplied test cards. Real cards are not accepted.';
  const expiry = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(details.expiry);
  if (!expiry) errors.expiry = 'Enter a valid expiry date as MM/YY.';
  else if (2000 + Number(expiry[2]) < now.getFullYear()
    || (2000 + Number(expiry[2]) === now.getFullYear() && Number(expiry[1]) < now.getMonth() + 1))
    errors.expiry = 'This test card has expired. Use the current month or a later date.';
  if (!/^\d{3}$/.test(details.securityCode)) errors.securityCode = 'Enter a 3-digit test security code, such as 123.';
  return { errors, outcome: Object.keys(errors).length ? null : card.outcome };
}
