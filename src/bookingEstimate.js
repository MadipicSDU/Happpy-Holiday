import { bookingPayload } from './utils.js';

// Catalogue rates are stored to two decimals. Integer cents keep fractional-hour
// rental and promotion rounding consistent with the server's decimal arithmetic.
const cents = value => BigInt(Math.round(Number(value) * 100));
const amount = value => Number(value) / 100;
const roundedDivide = (value, divisor) => (value + divisor / 2n) / divisor;

export function bookingEstimate({ venue, services, startsAt, endsAt, guests, quantities }) {
  let issue = '';
  try { bookingPayload(venue, startsAt, endsAt, guests, quantities); }
  catch (error) { issue = error.message; }

  const duration = new Date(endsAt) - new Date(startsAt);
  const validPeriod = startsAt && endsAt && Number.isFinite(duration) && duration > 0 && duration <= 365 * 86400000;
  const rentalCents = validPeriod ? roundedDivide(cents(venue.pricePerHour) * BigInt(duration), 3600000n) : null;
  const discountCents = rentalCents === null ? null : roundedDivide(rentalCents * cents(venue.promotionPercent || 0), 10000n);
  const catalogue = new Map(services.map(service => [service.id, service]));
  let servicesCents = 0n;
  const lines = Object.entries(quantities).map(([id, value]) => {
    const service = catalogue.get(id), quantity = Number(value);
    const valid = service && Number.isInteger(quantity) && quantity >= 1 && quantity <= 100000;
    if (!service) issue = 'A selected service is no longer listed. Remove it or refresh the catalogue.';
    const lineCents = valid ? cents(service.price) * BigInt(quantity) : null;
    if (lineCents !== null) servicesCents += lineCents;
    return { id, name: service?.name || 'Unavailable service', category: service?.category,
      quantity: value, unitPrice: service?.price, amount: lineCents === null ? null : amount(lineCents) };
  });

  return { issue, pricing: { premiseName: venue.name, address: venue.address, startsAt, endsAt,
    durationHours: validPeriod ? duration / 3600000 : null,
    rental: { name: venue.name, unitPrice: venue.pricePerHour, amount: rentalCents === null ? null : amount(rentalCents) },
    services: lines, promotionPercent: venue.promotionPercent || 0,
    rentalDiscount: discountCents === null ? null : amount(discountCents),
    totalAmount: issue || rentalCents === null ? null : amount(rentalCents - discountCents + servicesCents) } };
}
