# Sprint 3: alternatives, invoicing, and payment

Implemented October 14, 2026 against the [revised sprint plan](https://docs.google.com/document/d/1IoAJ1WBlfbxq47H66oPKdnwQpbUmW7Eh/edit) and [requirements](https://docs.google.com/document/d/1KCDe1cNk9SSDZI5o8UCOwKGf5AAvbb1Z/edit). The six detailed stories total 15 points; the summary says 21. This implementation follows the six detailed stories rather than inventing additional scope.

| Story | Implementation |
| --- | --- |
| 6.1 Unavailable premise detection | Staff order details check the stored rental period, excluding the order's own reservation. Invoice generation, delivery, and payment reject overlapping active reservations and already-started rentals. |
| 6.2 Alternatives and promotions | Availability returns other venues that fit the guest count and have no overlapping active reservations, sorted by discounted rental amount. Clients can select a suggestion after a quote/submission conflict, preserving dates, guests and services. Managers can review suggestions; replacing an existing booking belongs to Sprint 4. Admins configure 0–50% rental promotions. |
| 9.1 Invoice generation | Assigned managers/admins create one immutable invoice per pending/unpaid order. Client details, rental period/address, service names/quantities/rates, promotion and total are stored as a snapshot. Duplicate generation returns the existing invoice. Printable invoice/receipt view supports the browser's Print/Save PDF action. |
| 9.2 Portal delivery | Draft invoices are hidden from clients. Delivering once records a timestamp and moves the order to awaiting-payment; the owning client can then read it in booking details. Delivery is internal portal delivery, not an email or external message. |
| 10.1 In-system payment | Clearly labeled development-only demo checkout uses sample card details to simulate success/decline without actual charges. Only the supplied test cards are accepted; card details stay in the form. The server takes the amount from the invoice. Payment keys and a unique successful receipt prevent duplicate payment records, including concurrent retries. |
| 10.2 Paid status | Only a successful payment transaction confirms the order. Paid invoice/receipt is visible to the client and assigned manager. Declines preserve awaiting-payment, unpaid cancellation voids the invoice, and payment is blocked after cancellation. Status PATCH can no longer bypass invoice delivery or payment. |

## API and state

- `POST /api/premises/alternatives`: premiseId, startsAt, endsAt, guests, optional orderId. When orderId is supplied, authorization and the stored period/guest count are checked. Returns requestedAvailable, checkedAt, alternatives with rental/promotional estimates, and an availability-snapshot notice. Services and the client's three-venue policy are still checked by quote/create.
- `GET /api/orders/{id}/invoice`: authorized owning client (only after delivery), assigned manager, or admin. A draft is intentionally 404 to a client.
- `POST /api/orders/{id}/invoice`: staff generation; idempotent, unique per order.
- `POST /api/orders/{id}/invoice/deliver`: staff portal delivery; pending → awaiting-payment.
- `POST /api/orders/{id}/invoice/pay`: owning client; `{ idempotencyKey: UUID, outcome: "success" | "declined" }`. Successful simulation stores a DEMO reference, amount, timestamp, and `isDemo=true`; awaiting-payment → confirmed. No client amount, card data, or provider token is accepted as proof of payment.

Invoice states are draft, issued, paid, or void. Invoices and receipts have restricted history relationships. Booking, invoice delivery, payment, and cancellation use the same PostgreSQL advisory transaction lock; unique database indexes add a second safeguard. Returning a receipt for an already-paid invoice is idempotent and does not create another charge or receipt.

## Payment boundary

The requirements make gateway integration optional. A real provider was not specified, so this sprint uses the project demo flow. It is enabled only when the hosting environment is Development and `Payments:AllowDemo` is not false. Production cannot enable it even with AllowDemo=true; payment returns 503 until real provider integration exists. Both conditions have tests. Managers cannot declare an order paid with a status PATCH. UI labels and receipts say simulation/no money charged.

Supplier dispatch, execution scheduling, order changes, penalties/refunds, invoice expiry, automatic completion, and actual card/bank processing remain later work. Taxes/fees were not invented. Promotions reduce rental only; services stay at their quoted rates. New bookings freeze their promotion/rates, and existing invoices do not change after catalogue edits. Existing confirmed demo orders are not retroactively assigned payment receipts.

## Migration and preview

`20261014131627_Sprint3InvoicesPayments` adds invoices/payments and zero-default promotion/discount fields. Existing booking amounts and statuses are retained. Startup applies EF migrations; legacy EnsureCreated installations must still use the Sprint 2 baseline procedure first. Back up an installation before upgrading.

The local preview database was backed up to `.test-postgres/backups/before-sprint3-20261014-182155.dump` before upgrade. Only `hh_frontend_preview` on loopback port 15439 was upgraded for demonstration; no production database or Docker deployment was modified. Preview frontend is http://127.0.0.1:3001/ and API is http://localhost:5295. PostgreSQL startup now logs to the user's temporary directory rather than inside its data directory, avoiding a recovery-time sharing conflict with the active log file.

Try the workflow: create a future booking as a client → sign in as its assigned manager/admin → Orders / Review / Generate invoice → Deliver to client portal → client My bookings / View details / Demo checkout → simulate decline or success → inspect the saved receipt and confirmed order. Refresh the workspace after another account changes an order. Old bookings whose rental has already started cannot be newly invoiced or paid.

## Verification

18 backend tests pass, including immutable promotion/invoice pricing, authorization/draft privacy, duplicate generation, decline recovery, concurrent duplicate payment requests, server-owned payment amounts, cancellation voiding, conflict detection, and production/disabled-demo rejection. The legacy migration test verifies all current migrations, unchanged historical totals, and empty invoice/payment tables for old records. 16 frontend tests pass, including scoped invoice routes, stable payment keys on retry, and omission of client-provided amounts. Production frontend build passes.

At the initial implementation handoff, browser access had previously been declined, so no browser interaction or visual certification was claimed for that handoff. Backend verification used real HTTP and disposable PostgreSQL databases. Later browser checks and release verification are recorded below.

## Live booking receipt — October 27, 2026

The booking dialog now has a receipt panel on the right throughout details and review. The form and receipt line items have separate keyboard-accessible scroll areas; the receipt total stays visible. Dates, guests, rental duration/rate, promotions, selected service quantities, and totals update while editing. On smaller screens the receipt sits below the form with a collapsible breakdown.

The initial amount is labeled Live estimate. Review price replaces it with the server-returned quote and a Server-checked quote label. Invalid or incomplete input withholds the total and explains what to fix. Integer-cent arithmetic matches the backend's rental/promotion rounding; neither a local estimate nor a quote reserves a venue.

Verification: all 18 frontend tests and the production build pass. Additional read-only calls against the running preview verified matching rental, discount, and total amounts for 1-minute, 90-minute, and overnight 1,530-minute periods, with and without services. These checks created no bookings or payments. Browser visual/scroll verification is still pending under the existing browser-access restriction. Preview was restarted at http://127.0.0.1:3001/ with its existing database.

## Cancellation attribution — October 27, 2026

New cancellations store the authenticated user's ID, display name and role at the time of cancellation, plus a UTC cancellation timestamp. These snapshots remain unchanged after account renaming or repeated cancellation requests. Attribution comes from the server's authenticated account; client-supplied actor/time fields are ignored. Existing order visibility and cancellation rules remain in force, and invoice voiding shares the cancellation transaction and timestamp.

Status updates return the complete scoped booking response, including cancellation metadata and the saved venue, dates, guests, services, and pricing. Client booking cards, the staff order list, and booking details display cancellation attribution. Successful cancellation automatically opens booking details. Historical cancellations without attribution are explicitly labeled as unrecorded; no person or timestamp is inferred.

Migration `20261027084341_CancellationAudit` adds four nullable columns to orders. Name and role are historical snapshots, and the actor ID is retained independently of account deletion. The preview backup is `.test-postgres/backups/before-cancellation-audit-20261027-134308.dump`. The migration was applied to `hh_frontend_preview` and its 12 existing bookings were retained. No preview booking was cancelled for testing.

Verification used disposable PostgreSQL databases. The 18 existing backend tests passed, including migration compatibility; both new cancellation tests passed after adjusting their comparison to use persisted timestamps. New coverage checks all three actor roles, unauthorized cancellation attempts, spoofed attribution, immutable booking pricing, actor renaming, repeated requests, list/detail consistency, and legacy unknown attribution. All 18 frontend tests and the production build pass. Rendered markup checks cover cancellation details, retained package lines, and the historical fallback; interactive browser verification remains pending.

## Card-style demo checkout — October 27, 2026

The outcome dropdown is replaced with cardholder name, formatted card number, MM/YY expiry, and a masked three-digit security code. A separate amount summary shows the server-owned invoice total and reference. The form remains clearly labeled Demo mode, tells users not to enter real cards, and offers one-click sample cards: `4242 4242 4242 4242` succeeds and `4000 0000 0000 0002` declines. Expiry must be the current month or later; names and security codes are validated before submission. Any other card number is rejected by the form.

Card fields remain in component memory and are never included in payment requests or saved to browser storage. The security code clears after an attempt. The existing payment endpoint still receives only the stable idempotency key and demo outcome; invoice totals and receipts remain owned by the backend. Pending submissions disable inputs and block duplicate submits. A decline displays an inline error and permits retry; a successful payment replaces the form with its receipt. Production/disabled-demo policy is unchanged.

All 20 frontend tests and the production build pass. An isolated Edge browser with mocked API responses verified required-field focus, expired-date rejection, decline/retry, security-code clearing, pending controls, duplicate-submit protection, receipt rendering, key reuse, card-free request bodies/storage, disabled-demo rendering, and a 390px mobile layout. Screenshots are in `.test-postgres/payment-checkout-20261027/`. No live booking or payment was changed for these UI checks. Video preparation was stopped at the user's request, and its disposable API/database were removed.

## Occupied-date retry and scroll fix — October 27, 2026

Reproduced a client booking issue where an occupied-date response inserted a large alternatives section above the rental form. Browser scroll anchoring moved the form from scroll position 240px to 1,600px; repeated attempts hid the error and looked unresponsive even though quote requests reached the server.

Conflict feedback now stays in the modal footer beside Review price. Alternatives appear after the form and are reached explicitly with View alternatives. The form keeps its scroll position and input values during repeated checks, and the review button regains keyboard focus without scrolling after a failed request. Date, guest, or venue changes clear outdated availability feedback. Selecting an alternative preserves the period and services and returns to the updated rental details.

Alternative checks use the actual period/guest/venue values as dependencies, so equivalent request objects do not reload the results. Rechecking alternatives keeps the existing cards visible while the request is pending and disables selection until it finishes. Booking-modal scroll anchoring is disabled to prevent asynchronous result insertion from shifting the form.

All 20 frontend tests and the production build pass. Desktop (1440×900) and mobile (390×844) browser checks with mocked API responses verified five consecutive occupied-date attempts at different scroll positions, visible feedback, unchanged background scrolling, stable alternatives refresh, preserved service quantities/dates, choosing another venue, a submission-time conflict after a successful quote, clearing stale suggestions after editing dates, and a successful subsequent booking. These tests created no live orders. Reproduction/verification scripts and screenshots are in `.test-postgres/booking-conflict-20261027/`.

## Release verification — November 2, 2026

The complete backend suite passes all 21 tests against disposable PostgreSQL databases. All 20 frontend tests and the production frontend build pass. Demo booking generation now supports venues with capacities below 50, including a one-person venue; the new database-backed regression test verifies every generated booking stays within capacity.

This release includes the expanded service catalogue, 30-venue development seed with illustrative photo sources, Sprint 3 alternatives/promotions/invoices/demo checkout, live booking receipt, cancellation attribution, and the latest occupancy and conflict-retry fixes. Database files, backups, local browser artifacts, and the separate local `ACCOUNTS.md` edit are excluded from the release commit.
