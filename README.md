# Happy-Holiday

Event spaces booking & management platform.
Contains both a React frontend and a .NET Core Backend API.

## Frontend Features

- **Client Portal (Alex Wong)**: Home, My Events, Browse Spaces
- **Manager Portal**: Order Queue, My Clients, Venue Schedule & Invoicing, Analytics
- **Role Switcher**: Toggle button in the header

### How to Run Frontend
Open `index.html` directly in your browser or run:
```bash
python3 -m http.server 3000
```
Then visit [http://localhost:3000](http://localhost:3000).

---

## Backend API

The API supports JWT bearer authentication and two roles: `client` and `manager`.

### Run
```powershell
dotnet run --project HappyHoliday
```

In Development, the initial manager is seeded as:
- Email: `manager@happyholiday.local`
- Password: `Manager123!`

Use the requests in `HappyHoliday/HappyHoliday.http` to register, log in, and call protected endpoints.

### Endpoints
| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public; creates a client and returns a JWT |
| POST | `/api/auth/login` | Public; returns a JWT |
| POST | `/api/auth/managers` | Manager; creates another manager |
| GET | `/api/users/me` | Authenticated client or manager |
| GET | `/api/users/manager-area` | Manager only |

Passwords are hashed with ASP.NET Core's password hasher and are never returned by the API. Users are persisted in PostgreSQL through Entity Framework Core.
