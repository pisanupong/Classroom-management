# Classroom App — Claude Code Instructions

## Project Structure

```
classroom-app/
├── frontend/        # React + Vite + Tailwind CSS
├── backend/         # Node.js Express API
└── docker-compose.yml
```

## Deployment

📖 **อ่าน [DEPLOY.md](DEPLOY.md) ก่อนทุกครั้งที่จะ deploy** — มีขั้นตอนเต็ม, ลำดับคำสั่งตอนแก้ prisma schema, และกับดักที่เคยเจอ

สรุปสั้น ๆ:

- **Server:** `root@72.62.67.40` (srv1398976), app อยู่ที่ `/opt/classroom-app`
- **Frontend:** http://72.62.67.40:8081 (service `classroom-frontend`) — **Backend:** http://72.62.67.40:5000 (service `classroom-backend`)
- **Deploy ด้วย `scp` ไฟล์ที่แก้ขึ้นไปทับ ไม่ใช่ git** — VPS ผูกกับ repo คนละตัวกับ remote ที่เครื่อง dev (`git pull` บน VPS จะขึ้น `Already up to date` เสมอ)
- หลัง scp ต้อง `docker compose build --no-cache <services>` แล้วค่อย `up -d` — `up -d` เฉย ๆ ไม่ rebuild
- **DB คือ `classroom_db` @ `hotel-postgres:5432` บน VPS เท่านั้น** — `DATABASE_URL` ในเครื่อง dev ชี้ Supabase ที่ตายแล้ว คำสั่ง prisma จาก local จะได้ `P1001` เสมอ ต้องรันผ่าน `docker compose run --rm classroom-backend npx prisma db push` บน VPS และใช้ `db push` **ห้ามใช้ `migrate dev`** (จะขอ reset DB)

## Important Notes

- ตรวจชื่อ service ด้วย `docker compose config --services`
- Tailwind breakpoints: use `md:` (768px) for mobile/desktop splits, NOT `sm:` (640px) — some phones have CSS width ≥640px
- PowerShell 5.1 บนเครื่อง dev ไม่รองรับ `&&` — ใช้ `;` คั่นคำสั่งฝั่ง local
