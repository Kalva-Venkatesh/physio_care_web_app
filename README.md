# PhysioCare — Physiotherapy Clinic Management & Appointment Booking (MERN)

PhysioCare is a full-stack MERN (MongoDB, Express.js, React, Node.js) physiotherapy clinic management and dynamic appointment booking platform with **Patient**, **Physiotherapist**, and **Admin** portals.

## Key Capabilities

- **Dynamic Weekly Scheduling (`Asia/Kolkata` IST):** Generates genuine 30-minute time slots from each physiotherapist's working schedule while automatically excluding lunch breaks, clinic-wide holidays, specialist leave dates, past IST times, and already booked slots.
- **Atomic Double-Booking Prevention:** Uses a dedicated `SlotLock` MongoDB collection with a unique compound index `{ physiotherapistId, date, slotTime }` plus server-side validation so concurrent booking attempts for the same slot safely return `409 Conflict` without collisions.
- **Role-Based JWT Authentication (`bcryptjs` + `jsonwebtoken`):**
  - **Patient Portal:** Register, login, manage medical profile, book 30/60-min treatments, reschedule or cancel (immediately releasing locked slots), view appointment history, and read notifications.
  - **Physiotherapist Dashboard:** Review assigned appointments and patient medical intake, update session status (`confirmed`, `in_progress`, `completed`, `cancelled`), record pain score progression & clinical notes, and manage working hours / leave dates.
  - **Admin Dashboard:** View live clinic revenue & utilization charts (Recharts), manage treatments/pricing/durations, assign treatments & schedules to physiotherapists, configure clinic holidays, and manage patients & appointments.

## Environment Variables

Copy `.env.example` to `.env` for local development or configure in Render:

```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/physiocare?retryWrites=true&w=majority
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-react-site.onrender.com
SERVE_STATIC=false
VITE_API_URL=https://your-express-api.onrender.com
```

> **Local / Preview Mode:** If `MONGODB_URI` is left blank or retains placeholder credentials, the backend automatically starts a built-in MongoDB engine (`mongodb-memory-server`) and seeds realistic clinic data so all Mongoose schemas, indexes, and aggregations work immediately.

## Seeded Accounts (for Testing)

- **Admin:** `admin@physiocare.in` / `Admin@123`
- **Physiotherapist:** `lakshmi@physiocare.in` / `Physio@123` (also `rohan@physiocare.in`, `priya@physiocare.in`)
- **Patient:** `aarav@example.com` / `Patient@123` (also `sneha@example.com`)

## Local Development

```bash
npm install
npm run dev
```

Runs Express API + Vite React client together on `http://localhost:3000`.

## GitHub & Render Deployment Guide

### 1. MongoDB Atlas Setup
1. Create a free M0 cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a database user and allow network access (`0.0.0.0/0` for Render or Render outbound IPs).
3. Copy your SRV connection string (`MONGODB_URI`).

### 2. Deploy Express Backend as a Render Web Service
1. Push this repository to GitHub.
2. In Render, click **New + → Web Service** and connect your GitHub repo.
3. Configure:
   - **Build Command:** `npm install && npm run build:server`
   - **Start Command:** `npm run start:api`
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = `<your MongoDB Atlas URI>`
   - `JWT_SECRET` = `<strong random string>`
   - `CORS_ORIGIN` = `https://<your-static-site>.onrender.com`
   - `SERVE_STATIC` = `false`
5. Deploy and note the live API URL (e.g. `https://physiocare-api.onrender.com`).

### 3. Deploy React Frontend as a Render Static Site
1. In Render, click **New + → Static Site** and connect the same GitHub repo.
2. Configure:
   - **Build Command:** `npm install && npm run build:client`
   - **Publish Directory:** `dist`
3. Add Environment Variable:
   - `VITE_API_URL` = `https://physiocare-api.onrender.com`
4. Add a Rewrite Rule in Render Static Site **Redirects/Rewrites**:
   - Source: `/*` → Destination: `/index.html` (Action: `Rewrite`)
5. Deploy and verify your live PhysioCare web app!
