-- เพิ่มฟิลด์ระบบสุขภาพสัตว์เลี้ยง (ป่วย / บาดเจ็บ / ไอเทมรักษา / เวลาพักฟื้น)
-- ใช้กับตาราง "PetState"
-- รันได้ทั้งใน Supabase SQL Editor หรือ psql
-- (ทางเลือก: ใช้ `npx prisma db push` ซึ่งจะสร้างคอลัมน์เหล่านี้ให้อัตโนมัติ)

ALTER TABLE "PetState"
  ADD COLUMN IF NOT EXISTS "health"     TEXT NOT NULL DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS "item_herb"  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "item_kit"   INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "rest_until" TIMESTAMP(3);
