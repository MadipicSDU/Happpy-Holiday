# Sprint 5: cancellation terms, settlements and client tracking

The seven detailed stories (13.1, 13.2, 20.3, 14.1, 14.2, 17.1 and 17.2) total **16 points**. This implementation follows the detailed [team plan](https://docs.google.com/document/d/1IoAJ1WBlfbxq47H66oPKdnwQpbUmW7Eh/edit), rather than its inconsistent summary totals.

| Story | Implemented behavior | Demonstration |
| --- | --- | --- |
| 13.1 Post-deadline change rejection | Existing Sprint 4 guards reject submission and approval at or after the original/proposed cutoff. Clients can instead review cancellation. | Booking details → Changes / Cancel booking |
| 13.2 Cancel after deadline | Owner, assigned manager or administrator reviews a server cancellation quote and explicitly confirms it. Reservations and pending changes are released; private execution briefs are withdrawn atomically. | Booking → Cancel booking |
| 20.3 Configure penalty rules | Administrators create versioned early/late percentage rates and a change cutoff. New bookings snapshot those terms. Later policy updates do not change existing bookings. | Administration → Cancellation policy |
| 14.1 Calculate penalties | Before/after cutoff calculation uses the booking's full agreed value, two-decimal money rounding and applied recorded payments. A changed revision or changed reviewed amount rejects confirmation. | Cancellation quote |
| 14.2 Settle and report | An immutable cancellation statement retains penalty, payment applied, refund due, balance due and reason. Development-only demo settlement is idempotent and retains a reference. Original invoices/receipts remain historical records. | Booking → Cancellation statement |
| 17.1 Track client orders | Orders refresh every 30 seconds while the page is visible and on returning to it. Existing workspace and individual booking refresh controls remain available. | Client → My bookings |
| 17.2 View schedules and receipts | Clients see the finalized schedule for their current booking revision, alongside existing invoice/receipt history. Internal manager notes, staff identity and private instructions are excluded. | Booking → Event schedule / Receipt |

## Business rules and boundaries

- The brief supplies no cancellation percentages. Initial early and late rates are **0%**. Existing bookings migrate with zero rates, policy version 0 and their existing cutoff. Administrators can configure a policy for future bookings. Rates must be 0–100%, with at most two decimal places; cutoff hours must be 1–8,760.
- The quote/review step displays cancellation terms before a new booking is submitted. A frontend booking sends its reviewed policy version; a changed version requires a fresh quote. Stored booking terms are also shown in booking details.
- At the exact change deadline, the late rate applies. `penalty = round(order value × rate / 100, 2)`, `refund = max(applied payment − penalty, 0)`, and `balance due = max(penalty − applied payment, 0)`. Penalties cannot exceed the full order value. Previously issued change credits are already reflected in the applied paid balance.
- Cancellation is available before the event starts, including after the change deadline. An event that has started requires staff handling rather than releasing a live reservation. Completed and cancelled bookings are terminal. Cancelling twice returns the same statement.
- Cancellation does not claim a refund has happened. The statement remains `refund-pending` or `payment-due` until settled. Assigned staff can record a demo refund; the owning client or assigned staff can settle a demo penalty balance. Zero-balance statements settle without a financial movement.
- Demo settlement requires **Development** and `Payments:AllowDemo` enabled. Production cannot enable it by setting that flag. No real bank refund, payment gateway or external message is performed. All monetary demo movements are labeled as simulations.
- The old status PATCH cannot bypass a paid cancellation or a positive fee. It remains compatible for zero-fee unpaid cancellations and records the same audit attribution and statement.
- Cancellation, policy writes, payment, booking revisions and background completion share the existing PostgreSQL advisory transaction lock. Unique constraints prevent duplicate statements and policy versions.

## API

| Route under `/api` | Method | Access |
| --- | --- | --- |
| `/booking-policy` | GET | Client / manager / admin |
| `/admin/cancellation-policy` | GET, PUT | Read terms; administrator required for PUT |
| `/orders/{id}/cancellation/quote` | GET | Owning client / assigned manager / admin |
| `/orders/{id}/cancellation` | GET, POST | Same scoped access |
| `/orders/{id}/cancellation/settle` | POST | Same scoped access; refunds restricted to staff |
| `/orders/{id}/schedule` | GET | Same scoped access; current finalized/dispatched revision only |

Cancellation confirmation supplies `expectedRevision`, `expectedPenalty`, `expectedRefund`, `expectedAmountDue` and an optional reason. These values only confirm what was reviewed; the server calculates every authoritative amount again.

## Demonstration

1. As administrator, set a late rate and cutoff, then create a **new** future client booking within that cutoff.
2. Deliver and pay its invoice using the existing demo checkout.
3. Show that a change request is rejected after the cutoff. Review cancellation, inspect the penalty/refund and confirm.
4. Open the cancellation statement as manager and record a demo refund. Repeat settlement and verify its reference is unchanged.
5. For a separate unpaid booking, cancel with a positive rate and show the outstanding penalty and its demo settlement.
6. For a paid booking with a finalized execution plan, open the client Event schedule tab and its receipt. Keep it for completion/review in Sprint 6.
