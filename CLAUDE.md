# Classroom App — Claude Code Instructions

## Project Structure

```
classroom-app/
├── frontend/        # React + Vite + Tailwind CSS
├── backend/         # Node.js Express API
└── docker-compose.yml
```

## VPS Deployment

**Server:** `root@srv1398976` (IP: 72.62.67.40)
**App path on VPS:** `/opt/classroom-app`
**Frontend URL:** `http://72.62.67.40:8081`
**Backend URL:** `http://72.62.67.40:5000`

Docker service names:
- `classroom-frontend` — nginx serving built React app (port 8081)
- `classroom-backend` — Node.js API (port 5000)

## Deploy After Code Changes

### Step 1 — Commit & push from local

```bash
git add <changed files>
git commit -m "your message"
git push origin main
```

### Step 2 — Pull & rebuild on VPS

**Frontend changes** (anything inside `frontend/`):

```bash
cd /opt/classroom-app
git pull origin main
docker compose build classroom-frontend
docker compose up -d
```

**Backend changes** (anything inside `backend/`):

```bash
cd /opt/classroom-app
git pull origin main
docker compose build classroom-backend
docker compose up -d
```

**Both changed:**

```bash
cd /opt/classroom-app
git pull origin main
docker compose build
docker compose up -d
```

## Important Notes

- `docker compose up -d` alone does NOT rebuild — always run `build` first when code changes
- The old service name was wrong; correct names are `classroom-frontend` and `classroom-backend` (use `docker compose config --services` to verify)
- Tailwind breakpoints: use `md:` (768px) for mobile/desktop splits, NOT `sm:` (640px) — some phones have CSS width ≥640px
