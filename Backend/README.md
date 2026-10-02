# SkillSwap Backend

This backend replaces the frontend's localStorage data with a real server API and adds Socket.IO realtime events.

## 1. Install
Open CMD/PowerShell in this folder:

```bash
npm install
```

## 2. Configure
Copy `.env.example` to `.env` and change JWT_SECRET.

## 3. Run
```bash
npm start
```

Server:
http://localhost:5000

Health check:
http://localhost:5000/api/health

## Main endpoints

POST /api/auth/register
POST /api/auth/login
GET  /api/me
PUT  /api/profile
GET  /api/users
GET  /api/matches
POST /api/requests
GET  /api/requests
PATCH /api/requests/:id

Authorization:
Authorization: Bearer <JWT>

Realtime Socket.IO events:
- connected
- profileUpdated
- requestCreated
- requestUpdated

## Frontend integration

Your existing HTML currently stores users/current user/requests in localStorage and performs login, registration, profile saving and request creation in JavaScript. Those functions should be replaced with fetch() calls to this API.

The backend is intentionally simple for a college DBMS project: JSON persistence is used so it runs immediately without requiring MySQL. The API structure can later be switched to MySQL with the same frontend endpoints.
