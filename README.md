# Happy-Holiday

Event spaces booking & management platform.
Contains both a React frontend and a .NET Core Backend API.

## Frontend Features

- **Client workspace**: Overview, venue search, rental dates and service quantities, itemized price review, bookings, cancellation of pending/unpaid orders, and saved contact details.
- **Manager workspace**: Assigned orders and client contacts, real venue occupancy by period, and order summaries.
- **Administrator workspace**: Venue/service catalogue, staff accounts and manager client limits, plus all orders and clients.
- **UI/UX**: Responsive navigation, accessible dialogs, explicit loading/error/empty states, and accurate feedback after server-confirmed actions.

See [frontend Sprint 2 implementation and review](docs/frontend-sprint2.md).

### How to Run Frontend
Install dependencies and start Vite:
```bash
npm install
npm run dev -- --port 3000
```
Then visit [http://localhost:3000](http://localhost:3000).
The API URL defaults to `http://localhost:5294/api`; set `VITE_API_URL` before starting Vite or building to use another backend. For a different browser origin, configure the API's `Cors:AllowedOrigins` list explicitly.

---

## Backend API

The API supports JWT bearer authentication and `client`, `manager`, and `admin` roles.
Sprint 2 ordering, profiles, manager quotas, occupancy and pricing are implemented.
See [backend API, review findings and migration instructions](docs/backend-sprint2.md).

### Run
```powershell
dotnet run --project HappyHoliday
```

In Development, the initial manager is seeded as:
- Email: `manager@happyholiday.local`
- Password: `Manager123!`

Configure `ConnectionStrings__DefaultConnection` through environment variables or user secrets before starting the API. Configure `Jwt__Key` outside Development. For legacy databases created with `EnsureCreated`, follow the baseline instructions in the backend guide before upgrading.

Use the requests in `HappyHoliday/HappyHoliday.http` to register, log in, and call protected endpoints, or use `/swagger` in Development.

### Endpoints
| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public; creates a client and returns a JWT |
| POST | `/api/auth/login` | Public; returns a JWT |
| POST | `/api/auth/managers` | Admin; creates a manager |
| GET | `/api/users/me` | Authenticated client or manager |
| PUT | `/api/users/me` | Client; updates contact details |
| POST | `/api/orders/quote` | Client; previews itemized cost |
| POST | `/api/orders` | Client; creates a pending assigned booking |
| GET | `/api/orders` | Client owns / manager assigned / admin all |
| GET | `/api/premises/occupancy` | Manager or admin; rental periods and availability |

Passwords are hashed with ASP.NET Core's password hasher and are never returned by the API. Users are persisted in PostgreSQL through Entity Framework Core.
