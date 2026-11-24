# Implementation coverage for the six-sprint plan

The detailed plan contains **41 stories / 101 points**. Each sprint lasts two weeks for coursework allocation. Existing implementation notes and code cover Sprints 1–4; this change supplies the remaining Sprint 5–6 workflows.

| Sprint | Stories | Points | Main behavior | Guide |
| --- | --- | --- | --- | --- |
| 1 | 1.1, 1.2, 2.1, 20.1, 20.2, 7.1 | 14 | Client and manager authentication, premises and pilot service catalogues | README; backend Sprint 2 guide |
| 2 | 3.1, 4.1, 4.2, 7.2, 4.3, 5.1, 5.2, 8.1, 8.2 | 24 | Profiles, booking periods, three-venue policy, service selection, manager assignment, occupancy, conflicts and itemized prices | [Backend](backend-sprint2.md), [Frontend](frontend-sprint2.md) |
| 3 | 6.1, 6.2, 9.1, 9.2, 10.1, 10.2 | 15 | Alternatives/promotions, immutable invoices, portal delivery, demo payment and paid status | [Sprint 3](sprint3.md) |
| 4 | 11.1, 11.2, 12.1, 12.2, 16.1, 16.2, 20.4 | 18 | Execution, private staff briefs, deadline-bound changes, price differences, worklist, resource monitoring and service expansion | [Sprint 4](sprint4.md) |
| 5 | 13.1, 13.2, 20.3, 14.1, 14.2, 17.1, 17.2 | 16 | Late change rejection, reviewed cancellation, stored fee terms, statements/settlement, live tracking, client schedules and receipts | [Sprint 5](sprint5.md) |
| 6 | 15.1, 15.2, 18.1, 18.2, 19.1, 19.2 | 14 | Automatic completion/archival, utilization and settlement reports, biannual audits/CSV, venue and service reviews | [Sprint 6](sprint6.md) |

The project remains an alpha. Payment, credit and refund flows simulate financial movements in Development only. A real provider is optional in the brief and is not configured. Cancellation percentages default to zero until an administrator sets future-booking terms. Database cleanup means archival and audit, preserving financial and operational history.
