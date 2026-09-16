# Deploy Guide — Classroom App

คู่มือ deploy ฉบับจริงที่ใช้งานอยู่ (ตรวจสอบล่าสุด 2026-07-29)
**อ่านไฟล์นี้ก่อนเสมอเมื่อจะ deploy** — วิธีใน section "VPS Deployment" เก่าของ `CLAUDE.md` ที่ใช้ `git pull` **ใช้ไม่ได้แล้ว** (ดูหัวข้อ "กับดักที่เคยเจอ")

---

## สภาพแวดล้อม

| รายการ | ค่า |
|--------|-----|
| VPS | `root@72.62.67.40` (srv1398976) |
| App path | `/opt/classroom-app` |
| Frontend | http://72.62.67.40:8081 (service `classroom-frontend`, nginx) |
| Backend | http://72.62.67.40:5000 (service `classroom-backend`, Node.js) |
| Database | PostgreSQL `classroom_db` @ `hotel-postgres:5432` — คอนเทนเนอร์ใน docker network ของ VPS |

### ⚠️ ฐานข้อมูล

- **DB จริงคือ `hotel-postgres` บน VPS เท่านั้น** เข้าถึงได้จากในคอนเทนเนอร์ที่อยู่ docker network เดียวกัน
- `DATABASE_URL` ใน `backend/.env` ของเครื่อง dev ชี้ไป Supabase (`db.shosdtmjphzmyerjvqqt.supabase.co`) ซึ่ง **โปรเจกต์ถูกลบ/pause ไปแล้ว — DNS ไม่ resolve** คำสั่ง prisma ใด ๆ จากเครื่อง local จะได้ `P1001: Can't reach database server` เสมอ **นี่ไม่ใช่ปัญหาเน็ตหรือ prisma**
- ผลคือ **งานที่แตะฐานข้อมูลทุกอย่างต้องรันบน VPS ในคอนเทนเนอร์**

---

## วิธี deploy — copy ไฟล์ด้วย scp (วิธีที่ใช้จริง)

โปรเจกต์นี้ deploy โดย **scp ไฟล์ที่แก้ทีละไฟล์ขึ้นไปทับ** ไม่ได้ deploy ผ่าน git

### กรณีทั่วไป — แก้โค้ด ไม่แตะ schema

รันทีละคำสั่งบน PowerShell ที่เครื่อง dev

```bash
scp "D:\Project for dev\Classroom management\classroom-app\backend\routes\<file>.js" root@72.62.67.40:/opt/classroom-app/backend/routes/<file>.js
```

```bash
scp "D:\Project for dev\Classroom management\classroom-app\frontend\src\pages\<File>.jsx" root@72.62.67.40:/opt/classroom-app/frontend/src/pages/<File>.jsx
```

แล้ว build + restart (build เฉพาะ service ที่แก้ก็ได้)

```bash
ssh root@72.62.67.40 "cd /opt/classroom-app && docker compose build --no-cache classroom-backend classroom-frontend && docker compose up -d classroom-backend classroom-frontend"
```

### กรณีแก้ `prisma/schema.prisma` (เพิ่ม/แก้คอลัมน์)

scp ไฟล์ที่แก้ทั้งหมด **รวม `schema.prisma`** ขึ้นไปก่อน

```bash
scp "D:\Project for dev\Classroom management\classroom-app\backend\prisma\schema.prisma" root@72.62.67.40:/opt/classroom-app/backend/prisma/schema.prisma
```

แล้วรันตามลำดับนี้ — **build → db push → up -d**

```bash
ssh root@72.62.67.40 "cd /opt/classroom-app && docker compose build --no-cache classroom-backend classroom-frontend && docker compose run --rm classroom-backend npx prisma db push && docker compose up -d classroom-backend classroom-frontend"
```

**ทำไมต้องเรียงแบบนี้**

1. `build` ก่อน — เพราะ `db push` ต้องใช้ `schema.prisma` ตัวใหม่ที่ถูก copy เข้า image แล้ว
2. `run --rm` — เป็นคอนเทนเนอร์ชั่วคราวที่อยู่ใน docker network เดียวกัน จึง resolve `hotel-postgres` ได้ (จากเครื่อง local หรือจาก shell ของ VPS ตรง ๆ resolve ไม่ได้) และไม่ไปแตะคอนเทนเนอร์ที่รันอยู่
3. `up -d` ทีหลัง — ทำให้ไม่มีช่วงที่ backend เวอร์ชันใหม่วิ่งบน DB ที่ยังไม่มีคอลัมน์
4. เชื่อมด้วย `&&` — ถ้า `db push` fail จะหยุดทันที ของเดิมยังวิ่งอยู่ ไม่พัง

**ใช้ `prisma db push` ไม่ใช่ `prisma migrate dev`** — โฟลเดอร์ `prisma/migrations/` มีแค่ `20260530125344_init` ซึ่ง**ไม่มีตาราง `PetState`/`PetWord`** (ตารางเหล่านี้ถูกสร้างด้วย `db push` มาตลอด) ถ้ารัน `migrate dev` prisma จะเจอ drift แล้ว**ขอ reset ฐานข้อมูลทั้งก้อน**

ทางสำรอง ถ้า `db push` มีปัญหา: เขียน `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` แล้วรันผ่าน psql ในคอนเทนเนอร์ (ดูตัวอย่างที่ `backend/prisma/pet_health_migration.sql`)

---

## ตรวจผลหลัง deploy

```bash
ssh root@72.62.67.40 "cd /opt/classroom-app && docker compose ps && docker compose logs --tail=40 classroom-backend"
```

---

## กับดักที่เคยเจอ

| อาการ | สาเหตุ / ทางแก้ |
|-------|----------------|
| `git pull` ขึ้น `Already up to date` แล้วโค้ดใหม่ไม่ขึ้น | **VPS pull จาก `github.com/apexth/classroom-app` แต่ repo ที่เครื่อง dev มี remote เป็น `github.com/pisanupong/asset-manage.git`** — คนละ repo กัน push ไปยังไงก็ไม่ถึง จึงต้อง deploy ด้วย scp |
| build แล้วทุก layer เป็น `CACHED` รวมถึง `RUN npm run build` | ซอร์สไม่เปลี่ยน = ไฟล์ยังไม่ได้ scp ขึ้นไปจริง หรือ scp ผิด path ให้ใส่ `--no-cache` และเช็ค path ปลายทางให้ตรง |
| `db push` ขึ้น `The database is already in sync` ทั้งที่เพิ่งแก้ schema | `schema.prisma` บน VPS ยังเป็นตัวเก่า — ลืม scp ไฟล์นี้ขึ้นไป |
| `P1001: Can't reach database server` | รัน prisma จากเครื่อง local (ชี้ Supabase ที่ตายแล้ว) หรือรันจาก shell VPS นอก docker network — ต้องรันผ่าน `docker compose run --rm classroom-backend ...` |
| PowerShell error: `The token '&&' is not a valid statement separator` | PowerShell 5.1 ไม่รองรับ `&&` ใช้ `;` แทนสำหรับคำสั่งฝั่ง local (ส่วนที่อยู่ในเครื่องหมายคำพูดของ `ssh` เป็น bash ใช้ `&&` ได้ปกติ) |
| `docker compose up -d` แล้วโค้ดไม่เปลี่ยน | `up -d` เฉย ๆ ไม่ rebuild ต้อง `build` ก่อนทุกครั้งที่แก้โค้ด |

---

## หมายเหตุอื่น

- Tailwind breakpoints: ใช้ `md:` (768px) สำหรับแยก mobile/desktop **ไม่ใช่** `sm:` (640px) — มือถือบางรุ่นมี CSS width ≥ 640px
- ตรวจชื่อ service ได้ด้วย `docker compose config --services`
- สถานะสัตว์เลี้ยง (สุขภาพ/ไอเทม/เวลาพักฟื้น) เก็บใน `PetState` แล้ว sync ผ่าน `PUT /api/pet/state` จึงข้ามเครื่องได้ — ถ้าเพิ่มฟิลด์ใหม่ต้องแก้ทั้ง `schema.prisma`, `backend/routes/petRoutes.js` (whitelist ใน `PUT /state`) และ `frontend/src/pages/Pet.jsx`
