# Auction APP

A full-stack, real-time live auction platform with **server-authoritative fair-bidding logic**, role-based room access, and reconnection-safe state — built to solve the actual hard problems in live bidding (race conditions, fairness, and disconnect handling), not just a CRUD app with a countdown timer.

> Live demo: https://auction-app-eight-ruddy.vercel.app

---

## Why this project exists

Most auction app clones stop at "user submits a bid, highest number wins." The interesting problems are:

- What happens when two users bid in the same instant?
- How do you guarantee fairness when bids race against each other over a network with variable latency?
- What happens when the admin or a bidder loses connection mid-auction?

This project answers all three with a **server-authoritative locking mechanism**, **role-based permission system**, and **reconnection-safe room state**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (React, TypeScript) |
| Backend | Node.js + Express |
| Database | PostgreSQL (hosted on [Neon](https://neon.tech)) |
| ORM | Prisma |
| Auth | Email/password + OTP email verification, Google OAuth, HTTP-only secure session cookies |
| Real-time | WebSockets (Socket.io) |

---

## Core Features

### Authentication
- Sign up / log in with email + password, or Google OAuth
- OTP email verification on sign-up
- Forgot password / reset password flow
- Session persistence via HTTP-only secure cookies — valid for 30 days, after which re-authentication is required

### Roles
Every room has three participant types:

| Role | Permissions |
|---|---|
| **Admin** | Creates the room, sets each bidder's starting purse, approves/denies bidder requests, starts/stops the bidding clock, pushes items one by one, ends the room |
| **Bidder** | Must request admin approval to join as a bidder; can place bids only while the clock is active |
| **Audience** | Can join a public room directly; for a private room, just needs the room password (no admin approval required) |

### Rooms
- **Public rooms**: anyone currently on the site can join as audience instantly; joining as a bidder still requires admin approval
- **Private rooms**: admin shares a **Room ID**; joining (as either bidder or audience) requires the room password set at creation
- Every room is **isolated** — state, bids, and connected clients of one room never affect another
- Admin sets each bidder's **starting purse** before the auction begins

### Bidding Logic (fairness mechanism)
1. Admin pushes the current item up for auction
2. Admin starts the clock for that item
3. The **first bid received by the server** for that cycle is the winning bid for that round
4. The winning bidder's name is broadcast and displayed on every connected screen for **2 seconds**
5. All clients are **frozen** (bidding disabled) for those 2 seconds — this is enforced server-side, not just visually on the client, so no bid placed during the freeze window is accepted
6. After the freeze, bidding reopens for the next round on the same item until the admin moves to the next item
7. Admin manually pushes items one at a time and controls when the room ends

> Fairness is guaranteed by determining "first bid" based on **server receipt order**, not client-reported timestamps — client clocks/latency are never trusted for resolving who bid first.

### Resilience
- **Auto-end on admin disconnect**: if the admin is disconnected from the room for more than 15 minutes, the room ends automatically
- **Reconnection-safe state**: if any participant (admin, bidder, or audience) loses connection and rejoins, they're synced to the room's **current live state** — not dropped back to the start
- **History**: every logged-in user can view their auction history — rooms they attended and items they won

---

## Project Structure

```
Auction-APP/
├── frontend/          # Next.js app — UI, auth pages, room UI, dashboard
│   ├── src/
│   ├── prisma/        # if schema is shared/used here
│   └── package.json
├── backend/           # Express API + WebSocket server
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── sockets/    # bidding/freeze/lock logic lives here
│   │   └── prisma/     # Prisma schema + client
│   └── package.json
└── README.md
```

> Update this once you confirm your actual folder layout — particularly where your Prisma schema lives and where the bid-lock/freeze logic is implemented.

---

## Getting Started (Local Setup)

### Prerequisites
- Node.js v18+
- A PostgreSQL database (Neon recommended, or any Postgres instance)
- Google OAuth credentials (Client ID/Secret) if testing Google sign-in
- SMTP credentials or an email service (for OTP + password reset emails)

### 1. Clone the repo

```bash
git clone https://github.com/Prince9805/Auction-APP.git
cd Auction-APP
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
DATABASE_URL=postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require
PORT=4000
JWT_SECRET=<your_secret>
COOKIE_SECRET=<your_secret>
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>
SMTP_HOST=<your_smtp_host>
SMTP_USER=<your_smtp_user>
SMTP_PASS=<your_smtp_pass>
```

Generate the Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

Start the backend:

```bash
npm run dev
```

### 3. Frontend setup

```bash
cd ../frontend
npm install
```

Create a `.env.local` file in `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

Start the frontend:

```bash
npm run dev
```

### 4. Open the app

Visit `http://localhost:3000`.

> ⚠️ Double-check the exact env var names against your actual `.env.example` files and fix any mismatches above.

---

## How to Use the App

1. **Sign up** with email (verify via OTP) or **log in** with Google/email+password.
2. From the dashboard, either **create a room** (public or private, set bidder starting purse) or **join a room** by Room ID.
3. If joining a private room: enter the room password, then choose to join as **bidder** (requires admin approval) or **audience** (joins immediately).
4. If joining a public room: audience joins instantly; bidders still need admin approval.
5. **Admin** pushes an item, starts the clock — bidders race to bid first each round; winner is shown for 2 seconds while the room freezes.
6. Admin pushes the next item when ready, and ends the room when the auction is complete.
7. Stay logged in for up to 30 days via secure session cookie, or check your **history** anytime to see past rooms attended and items won.

---

## For Developers — Working With This Codebase

### Where the hard logic lives

| If you want to... | Look at... |
|---|---|
| Modify the bid-locking/freeze logic | `backend/src/sockets/` — the WebSocket handler resolving "first bid" per round |
| Change room access rules (public/private, approval flow) | `backend/src/controllers/` (room/permission logic) |
| Adjust the admin-disconnect auto-end timer | wherever the 15-min heartbeat/timeout check is implemented in the backend |
| Modify auth (OTP, Google OAuth, password reset) | `backend/src/routes/` (auth routes) + `frontend/` auth pages |
| Change the DB schema | `prisma/schema.prisma` + run a new migration |

> Fill in exact paths once confirmed.

### Design notes worth knowing before you touch the bidding logic

- "First bid wins the round" is resolved by **server receipt order**, not client timestamps — this is intentional and should not be changed to trust client-side time.
- The room must hard-lock (reject all further bids) the instant the first valid bid for a round is accepted, *before* the 2-second freeze broadcast goes out — otherwise two near-simultaneous bids can both be accepted before clients receive the freeze signal.
- Room state needs to be readable on reconnect — if you move state from in-memory to a persistent store, make sure rejoin logic reads from the same source of truth.

### Running migrations / Prisma Studio

```bash
npx prisma studio       # inspect DB visually
npx prisma migrate dev  # apply schema changes
```

### Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit with clear messages
4. Open a Pull Request

---

## Known Limitations / Roadmap

- [ ] Load-test the freeze mechanic under truly simultaneous concurrent bids (automated script, not manual clicking)
- [ ] Document whether room state is in-memory per server instance or persisted (affects horizontal scaling)
- [ ] Add automated tests for the admin-disconnect auto-end timer
- [ ] Add rate limiting on bid/auth endpoints
- [ ] Dockerize for easier local setup

---



## Author

Built by [Prince](https://github.com/Prince9805).
