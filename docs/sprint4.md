# Sprint 4: booking changes and event execution

Implemented against the [revised sprint plan](https://docs.google.com/document/d/1IoAJ1WBlfbxq47H66oPKdnwQpbUmW7Eh/edit) and [requirements](https://docs.google.com/document/d/1KCDe1cNk9SSDZI5o8UCOwKGf5AAvbb1Z/edit). The detailed Sprint 4 section contains seven stories totaling 18 points; its summary table lists different totals. This implementation follows the seven detailed stories.

## Delivered stories

| Story | Result | Where to demonstrate |
| --- | --- | --- |
| 11.1 Finalize execution schedule | A manager creates a versioned activity schedule after recorded payment covers the current booking. Finalization checks all services, rental boundaries, staff assignments, and overlapping staff commitments. | Orders → Review → Execution schedule |
| 11.2 Dispatch staff / performer requests | Dispatch publishes immutable, private briefs to assigned staff accounts. Staff acknowledge, start, and complete activities; superseded briefs remain visible as withdrawn history. | Manager schedule → Dispatch; staff → Execution briefs |
| 12.1 Check change eligibility | The client sees the booking's deadline and can propose venue, dates, guests, and service changes before it. The agreed default cutoff is **168 hours / 7 days**. | Client → My bookings → View details → Booking changes |
| 12.2 Recalculate and reschedule changes | A server quote shows the proposed package and payment difference. Manager approval rechecks availability, replaces the reservation atomically, preserves earlier invoice snapshots, issues the difference or a demo credit, and withdraws obsolete execution briefs. | Client submits; manager approves; client pays any additional invoice |
| 16.1 Manager client / order dashboard | Assigned worklist, client counts, pending changes, unpaid orders, schedules needed, and direct order links. | Manager → Dashboard → Worklist |
| 16.2 Live occupancy / service monitoring | Timestamped venue occupancy, peak reserved service quantities and remaining configured capacity, staff assignments, and activity progress. Refreshes every 30 seconds while visible. | Dashboard → Venues / Services / Staff |
| 20.4 Expanded service categories | Animators, hosts, musicians, dancers, furniture, and decoration are supported in the visual picker and administration. Fresh demo databases include examples. | Venue booking → Services; Administration → Services |

## Booking and payment rules

- The cutoff is stored per booking. Configure `OrderChanges__CutoffHours` for future bookings; default `168`. Existing bookings receive 168 hours during the migration. Both request submission **and approval** must occur strictly before the cutoff for the earlier of the original and proposed starts. Moving an event later cannot reopen a closed change window.
- A pending proposal keeps the original venue and service reservation. It does not reserve the proposed replacement. Only one proposal may be pending per order. Clients can withdraw it; assigned managers or administrators can approve or reject it with a note.
- Approval checks the current booking revision, venue availability, guest capacity, the client's simultaneous venue limit, and service stock. Accepted proposal prices remain fixed even if catalogue rates subsequently change. The client must have reviewed the same total at submission.
- A positive unpaid balance creates a new revision invoice and requires a new payment. Already paid money is applied once. Zero balances remain covered. Negative balances create a clearly marked **demo credit note** and reduce the booking's applied paid balance; no real refund occurs. Demo credits require Development with demo payments enabled.
- Old invoice pricing, receipts, approved proposals, and staff brief snapshots are retained. An unpaid older invoice is voided when superseded. Checkout supplies the exact invoice ID and a per-invoice idempotency key so a stale payment cannot charge a newer revision.
- Paid bookings cannot use the unpaid cancellation shortcut. Sprint 5's cancellation penalties, real refunds, and late change policies are outside Sprint 4.

## Execution and access rules

- `confirmed` alone is insufficient: an execution plan also requires recorded payment metadata covering the current total. Historical sample confirmations without receipts are not treated as paid.
- Every booked service must appear in the finalized plan; venue preparation activities may also be added. Activities stay inside the rental period. Every activity needs an existing `staff` account before finalization. A person cannot cover overlapping finalized or dispatched activities, including two activities in the same plan. Adjacent activities are allowed.
- Saving a revised draft withdraws earlier briefs. Finalize and dispatch again to publish the replacement. Once an activity has started or completed, the published plan cannot be rewritten. Booking approval invalidates the old revision's schedule.
- Staff briefs are delivered **inside the application**. No email or external performer message is sent. Briefs include venue, address, timing, services, guest count, manager name, and instructions, without client contact or financial details.
- Staff can read and update only their own briefs. Progress follows sent → acknowledged → in progress → completed; starting before the activity time is rejected. Withdrawn briefs cannot advance. Repeated successful actions do not duplicate dispatch or payment.
- Managers see their assigned clients and worklist. Global occupancy, service quantities, and staff availability support resource planning without exposing other managers' client contacts. Administrators can view all operations.

## Capacity and monitoring

`ConcurrentCapacity` is optional on a catalogue service. Empty means no configured stock limit; a positive value limits simultaneous reserved **quantity**, not daily sales. The same quantity unit used in the service price is used for stock. Set an appropriate catalogue unit and description before configuring capacity. Reservations consume stock across their entire venue rental. Staff scheduling is checked separately.

Peak demand uses interval overlap, with ending reservations released before adjacent reservations begin. Booking, change approval, capacity updates, payment, and dispatch use the existing shared database transaction lock. Lowering capacity below existing future demand is rejected. Changing a proposal does not release the original stock until approval.

The dashboard polls every 30 seconds while visible, refreshes on returning to the page, and shows its actual snapshot time. It is not a push notification service. Monitoring periods may span at most 31 days; the worklist covers active assigned orders independently of that period.

## Migration and local demo

Migration: `20261102164247_Sprint4ExecutionAndChanges`. Back up a real database with `pg_dump -Fc` before starting the upgraded API; startup applies migrations automatically. Existing orders and invoice pricing are retained. Paid balances and payment timestamps are backfilled **only from recorded payments**, never inferred from a confirmed status. Invoice uniqueness is now per order and revision. Downgrading is blocked if an order has multiple financial documents, because the earlier schema cannot preserve them.

Development seeding creates three service staff accounts only when there are no staff accounts:

| Account | Demo password | Name |
| --- | --- | --- |
| `staff.host@happyholiday.local` | `Staff123!` | Demo Event Host |
| `staff.av@happyholiday.local` | `Staff123!` | Demo AV Technician |
| `staff.performer@happyholiday.local` | `Staff123!` | Demo Performer |

Existing catalogue entries are not overwritten. Fresh databases receive the expanded categories; existing installations can add them through Administration. These are local development accounts. Administrators can create separate staff / performer accounts through the staff form.

The local `hh_frontend_preview` database on `127.0.0.1:15439` was upgraded on 2026-11-02 after a custom-format backup at `.test-postgres/backups/before-sprint4-20261102.dump`. All **17 bookings, 32 venues, four invoices, and two payments** remained present. The backfilled applied paid total matches the recorded payments (KZT 81,720). Five missing demo category entries were then added through the admin API, increasing the catalogue from 12 to 17 services. The preview is running at `http://127.0.0.1:3001/` with API `http://localhost:5295/api`.

For a complete demonstration, create a future booking more than seven days away, issue and deliver its invoice, pay with the sample successful card, request a date or service change, approve it as the assigned manager, pay any difference, create and finalize the execution schedule, dispatch it, then sign in as the assigned staff member and acknowledge the brief. The dashboard shows the new reservation and resource allocation. Use an activity whose real start time has arrived to demonstrate starting and completion.

## API additions

| Route under `/api` | Methods | Access |
| --- | --- | --- |
| `/orders/{id}/changes` | GET, POST | Owner client or assigned manager / admin for reads; client for proposals |
| `/orders/{id}/changes/quote` | POST | Owner client |
| `/orders/{id}/changes/{changeId}/withdraw` | POST | Owner client |
| `/orders/{id}/changes/{changeId}/review` | POST | Assigned manager / admin |
| `/orders/{id}/invoice/history` | GET | Scoped order access; client sees delivered documents |
| `/orders/{id}/execution` | GET, PUT | Assigned manager / admin |
| `/orders/{id}/execution/finalize`, `/dispatch` | POST | Assigned manager / admin |
| `/staff/briefs`, `/staff/briefs/{id}` | GET, PATCH | Assigned staff only |
| `/management/dashboard`, `/management/operators` | GET | Manager / admin |

Order responses include `revision`, `changeDeadline`, `pendingChangeId`, `paidAmount`, `paymentConfirmedAt`, and `executionState`. Plan writes require `expectedVersion`; change submission requires `expectedRevision` and `expectedTotal`. Payment now requires the reviewed `invoiceId` in addition to its idempotency key.

## Verification

On 2026-11-02, all **30 backend tests**, **23 frontend tests**, and the production frontend build passed. Backend tests used disposable PostgreSQL databases. Coverage includes migration preservation and payment backfill, exact payment differences and credit history, stale invoices, deadline checks, withdrawals, availability changes between proposal and approval, quoted price snapshots, concurrent stock reservations, adjacent intervals, role scoping, staff conflicts, dispatch idempotency, withdrawn briefs, and live staff progress.

An isolated headless Edge walkthrough against the real API and a separate `hh_sprint4_qa_20261102` database passed: client proposal and quote → manager approval → additional demo card payment → execution draft → finalization → dispatch → staff acknowledgment → manager progress. The same run checked venue occupancy, reserved service units, staff assignments, and 390px mobile layouts, without uncaught browser errors or server errors. A focused follow-up verified that microsecond rental boundaries remain valid when editing and finalizing activities, and that the dashboard uses the existing workspace refresh control. Historical GET requests returning 404 for absent plans are expected and handled by the UI.

Local QA scripts, results, and screenshots are preserved under `.test-postgres/sprint4-qa-20261102/` (ignored by Git). Browser test fixtures exist only in the separate QA database. No videos were recorded. The extra QA servers are stopped after verification; the normal preview remains available.

Run backend tests with `HAPPYHOLIDAY_TEST_POSTGRES` set to a local administrative PostgreSQL connection. Tests create and drop isolated `hh_test_*` databases. Run `npm test` and `npm run build` for frontend checks.
