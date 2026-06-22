# Auction APP

A full-stack live auction platform with real-time bidding and **concurrency-safe bid resolution** — built to handle the hard part most tutorial auction apps skip: multiple users bidding on the same lot at the same instant without race conditions, lost bids, or double-wins.

> Live demo: `https://auction-app-eight-ruddy.vercel.app'

---

## Why this project exists

Most "auction app" tutorials stop at a form that writes a bid to a database. The interesting (and hard) problem is what happens when two users submit a bid on the same item in the same millisecond. This project's core engineering goal is correctness under concurrent writes — not just a CRUD app with a countdown timer.

Key things this app actually solves:
- **Atomic bid resolution** — concurrent bids on the same lot are resolved with DB-level atomicity (transactions / row locking), so the highest valid bid always wins and no bid is silently dropped.
- **State persistence** — if an admin or auctioneer disconnects mid-auction, the room's state survives and reconnects cleanly.
- **Room isolation** — each auction room's state and bid stream is isolated from others, so concurrent auctions don't interfere with each other.

---

## Tech Stack

| Layer        | Technology |
|---------------|------------|
| Frontend      | Next.js (React, TypeScript) |
| Backend       | Node.js + TypeScript |
| Database      | PostgreSQL |
| Auth          | NextAuth.js |
| Deployment    | Vercel (frontend), Render (backend) |

---

## Project Structure

```
Auction-APP/
├── frontend/          # Next.js app (UI, pages/routes, NextAuth config)
│   ├── src/
│   ├── package.json
│   └── ...
├── backend/           # Node.js + TypeScript API server
│   ├── src/
│   ├── package.json
│   └── ...
└── README.md
```

> Note: frontend and backend are separate apps with their own `package.json` and dependencies — run and deploy them independently.

---

## Features

- User authentication (NextAuth.js)
- Create and join live auction rooms
- Real-time bid placement and updates
- Concurrency-safe bid resolution (atomic DB transactions)
- Admin/auctioneer controls per room
- Reconnect-safe auction state

---

## Getting Started (Run it locally)

### Prerequisites

- Node.js v18+
- npm or yarn
- PostgreSQL (local instance or a hosted one, e.g. Supabase / Neon / Railway)

### 1. Clone the repo

```bash
git clone https://github.com/Prince9805/Auction-APP.git
cd Auction-APP
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<db_name>
PORT=4000
JWT_SECRET=<your_secret>
```

Run database migrations (if applicable):

```bash
npm run migrate
```

Start the backend dev server:

```bash
npm run dev
```

### 3. Set up the frontend

```bash
cd ../frontend
npm install
```

Create a `.env.local` file in `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<your_secret>
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<db_name>
```

Start the frontend dev server:

```bash
npm run dev
```

### 4. Open the app

Visit `http://localhost:3000` in your browser. The backend API runs on `http://localhost:4000`.

> ⚠️ Update the exact env var names and ports above to match what's actually in your `backend/.env.example` and `frontend/.env.example` — fill those in once you confirm them.

---

## How to Use the App (End User)

1. **Sign up / log in** via the auth page (NextAuth).
2. **Create an auction room** — set the item, starting price, and end time.
3. **Share the room link** with bidders.
4. **Bidders join the room** and place bids in real time; the current highest bid updates live for everyone in the room.
5. **Auction closes** at the set end time (or manually by the admin) — the highest valid bid wins, resolved atomically.

---

## For Developers — How to Work With This Codebase

### Architecture overview

- **Frontend (`/frontend`)**: Next.js app responsible for UI, auth (NextAuth), and consuming the backend API. Pages/routes live under `frontend/src` (or `app/` if using the App Router).
- **Backend (`/backend`)**: Node.js + TypeScript API server. Owns all auction/bid business logic and talks directly to PostgreSQL. This is where the concurrency-safe bid resolution logic lives — look here first if you're extending bidding behavior.
- **Database**: PostgreSQL. Auction rooms, bids, and users are the core tables. Bid writes use transactions (and/or row-level locking) to guarantee atomic resolution under concurrent submissions.

### Key areas to look at if you want to extend this

| If you want to... | Look at... |
|---|---|
| Change bid resolution logic | `backend/src/` — bid service / controller handling bid submission |
| Add a new auction room feature | `backend/src/` (API + DB) and `frontend/src/` (room UI) |
| Modify auth behavior | `frontend/` NextAuth config |
| Change DB schema | migration files in `backend/` |

> Fill in exact subfolder paths once you confirm them — e.g. `backend/src/services/bidService.ts`, `backend/src/db/migrations/`, etc.

### Running tests (if/once added)

```bash
cd backend && npm run test
cd frontend && npm run test
```

### Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes with clear messages
4. Push and open a Pull Request

---





## Author

Built by [Prince](https://github.com/Prince9805).
