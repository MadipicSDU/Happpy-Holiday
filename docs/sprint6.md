# Sprint 6: automatic completion, reporting, audits and reviews

The six detailed stories (15.1, 15.2, 18.1, 18.2, 19.1 and 19.2) total **14 points** in the [team plan](https://docs.google.com/document/d/1IoAJ1WBlfbxq47H66oPKdnwQpbUmW7Eh/edit).

| Story | Implemented behavior | Demonstration |
| --- | --- | --- |
| 15.1 Ended rental detection | A hosted worker checks ended paid and unpaid bookings every minute by default. | Wait for the next interval, or administrator → Reports → Process ended bookings |
| 15.2 Completion and archival | Fully paid bookings become completed. Unpaid bookings become expired and open invoices are voided. History is retained for both outcomes. | Client → My bookings → Closed |
| 18.1 Demand and utilization analytics | Server reports venue hours, paid hours, idle hours, utilization, monthly demand, exact registered-address demand, service units and recorded financial movements. | Reports → Period reports, ratings and feedback |
| 18.2 Biannual audit | Administrators select a half-year, export authenticated CSV and inspect integrity/maintenance findings. Cleanup archives closed history and expires stale proposals in bounded batches. | Reports → Biannual audit and maintenance |
| 19.1 Reviews | The owning client can submit one 1–5 venue rating after a paid event completes, with optional comment and individual ratings for booked services. | Completed booking → Review |
| 19.2 Rating aggregates | Catalogue aggregates contain anonymous venue/service averages and counts. Managers view feedback only for assigned bookings; administrators view all. | Reports → Venue and service ratings / Client feedback |

## Completion and retained history

`Lifecycle:Enabled` defaults to true, `Lifecycle:IntervalSeconds` to 60 (range 10–3,600), and `Lifecycle:BatchSize` to 500 (range 1–5,000). Settings are validated at startup. The worker waits one interval before its first scan, creates a scoped database context per run, catches transient failures and retries next interval. Multiple API instances serialize through the booking lock.

The worker completes a confirmed booking after its rental ends when the recorded payment covers the total. It expires an ended pending or awaiting-payment booking when the recorded paid amount is zero and there is no payment confirmation. An ended booking with a balance due and payment on record remains flagged for staff review, as does a legacy confirmation with no payment record. Paid completion follows the rental period and does not depend on staff marking every brief done.

Both outcomes record `ArchivedAt`, expire pending change requests and add an audit entry. Paid completion also records `CompletedAt`. Expiry voids outstanding unpaid invoices without removing them. Archived bookings remain in the closed-history view.

## Report definitions

- Report periods are start-inclusive/end-exclusive, at most 366 days. The UI offers calendar half-years. Month buckets and CSV dates use UTC, while ordinary booking displays retain local-time formatting.
- Occupancy merges overlapping intervals separately for each venue and clips them to the selected period. Pending, awaiting-payment, confirmed and completed reservations count toward occupancy. Cancelled and expired bookings are excluded. Paid hours require recorded payment covering the booking.
- Available hours use the full reporting window for every currently listed venue. Idle hours are available minus merged reserved hours. This assumes continuous availability; it does not infer opening hours or historic acquisition dates that the project does not store.
- Booking counts include cancelled and expired bookings that overlap the period. Monthly counts, quoted order value and service demand use bookings **starting** in the period. Cancelled and expired orders are excluded from value and service demand.
- Cash uses posting timestamps: successful invoice payments minus settled change credits and cancellation refunds, plus settled additional cancellation penalties. Outstanding statements remain separate. Demo amounts are recorded simulations and are not bank transactions. Managers see their assigned bookings and financials only.
- Location analysis uses exact registered addresses; the system does not guess districts from free text. Anonymous catalogue rating aggregates are global. Individual feedback remains scoped to the manager's orders.
- CSV is administrator-only, downloaded with an Authorization header rather than a token in its URL. Cells are quoted and spreadsheet formula prefixes are neutralized. The export omits private client contacts.

## API

| Route under `/api` | Method | Access |
| --- | --- | --- |
| `/reports/analytics?from=...&to=...` | GET | Manager / admin, financial and booking scope enforced |
| `/admin/maintenance/audit?year=2026&half=2` | GET | Admin |
| `/admin/maintenance/export?year=2026&half=2` | GET (CSV) | Admin |
| `/admin/maintenance/complete-expired` | POST | Admin |
| `/admin/maintenance/archive` | POST | Admin; up to 500 closed records and 500 stale proposals per call |
| `/orders/{id}/review` | GET, POST | Scoped read; owning client required for submission |
| `/reviews/summary` | GET | Client / manager / admin; anonymous aggregates |
| `/reviews/feedback?page=1` | GET | Manager / admin; 30 scoped reviews per page |

Ratings must be 1–5, comments at most 2,000 characters, and optional service ratings must be unique and refer to services in the completed booking. Exact duplicate submissions return the same review. A different second review is rejected. Cancelled events and unpaid historical sample confirmations cannot be reviewed.

## Migration and operation

Migration `20261116173034_Sprint5And6LifecycleReporting` adds lifecycle timestamps, stored cancellation rates, versioned policies, cancellation statements, reviews and audit records. Legacy rates default to zero, and unknown historical creation/completion timestamps stay null. Existing orders and financial records are preserved. Back up a database before starting the updated API; startup applies migrations.

Downgrading is blocked once policy, settlement, review or audit history exists, because the previous schema cannot preserve those records. Restore a pre-upgrade backup for rollback.

The original local preview database was not upgraded or seeded for this implementation's automated checks. Database-backed tests create and drop their own `hh_test_*` databases on the local development PostgreSQL instance.

## Verification

Verification completed on 2026-11-17:

- The full backend suite passed **40 tests with no skips**, including both existing migration-preservation checks. After the last completion/report changes, the affected completion/status and cancellation-to-report cases passed again. The build has zero warnings and errors.
- All **28 frontend tests** passed. The production Vite build passed.
- An isolated headless Edge walkthrough with mocked API responses passed policy editing, paid cancellation confirmation, statement visibility, client schedule access, venue/service review submission, reporting/CSV download, demo-refund settlement and 390px client/report layouts. It produced no uncaught JavaScript errors or page-wide horizontal overflow on mobile. Dialog tabs and narrow report tables scroll horizontally instead of splitting words.
- UI mocks verify interactions and layout; real PostgreSQL integration tests independently verify authorization, immutable terms, exact penalty/refund amounts, duplicate handling, completion eligibility, review ownership, schedule privacy, report scope and settlement arithmetic.

Local UI verification scripts, screenshots, a sample CSV and results are under `.test-postgres/sprint56-qa/` (ignored by Git). No existing preview booking, payment, cancellation policy or production data was changed by those checks.

Run database-backed checks with `HAPPYHOLIDAY_TEST_POSTGRES` pointing to a local PostgreSQL database where the test account may create disposable databases, then `dotnet test HappyHoliday.slnx`. Run `npm test` and `npm run build` for frontend checks.
