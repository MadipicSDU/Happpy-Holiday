# Happpy-Holiday

Event spaces booking & management platform built with React, based on the Figma design.

## Features

- **Client Portal (Alex Wong)**:
  - **Home**: Welcome dashboard, quick actions ("Browse Spaces", "My Events"), and "Your Next Event" preview card.
  - **My Events**: View and manage bookings (`HH-90218`, `HH-492318`, `HH-312948`), status badges (Pending, Confirmed, Completed), modify dates/guests modal, cancel booking modal, and fee notices.
  - **Browse Spaces**: Full catalog of event spaces with photos, guest capacity, pricing, and reservation modal.

- **Manager Portal**:
  - **Order Queue**: Inbound booking management (`ORD-5541` to `ORD-5545`) with filters by status and date, order details modal, and status update controls.
  - **My Clients**: Client directory with real-time search, booking history, contact info, and client profile dossier.
  - **Venue Schedule & Invoicing**: Weekly timeline (Monday–Friday) showing hall allocations across Corporate, Social, and Prep slots; interactive Invoice Generator and live Invoice Preview.
  - **Analytics**: Key performance indicators including gross revenue, confirmed bookings count, and space occupancy rates.

- **Role Switcher**:
  - Convenient toggle button in the header to switch between Client View and Manager Portal.

## How to Run

### Option 1: Direct in Browser
Open `index.html` directly in your browser:
```bash
open index.html
```

### Option 2: Local Server
```bash
python3 -m http.server 3000
# or
node server.js
```
Then visit [http://localhost:3000](http://localhost:3000).
