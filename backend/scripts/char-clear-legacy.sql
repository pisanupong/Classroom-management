-- ล้าง character_data ฟอร์แมตเก่า (มีคีย์ grid แต่ไม่มีคีย์ skin)
-- เอดิเตอร์ปัจจุบันอ่านไม่ได้อยู่แล้ว ล้างทิ้งเพื่อให้เริ่มปั้นใหม่
BEGIN;

\echo '=== ก่อนล้าง ==='
SELECT id, username, length(character_data::text) AS json_len
FROM "User"
WHERE character_data IS NOT NULL
  AND character_data ? 'grid'
  AND NOT (character_data ? 'skin');

UPDATE "User" SET character_data = NULL
WHERE character_data IS NOT NULL
  AND character_data ? 'grid'
  AND NOT (character_data ? 'skin');

COMMIT;

\echo '=== หลังล้าง (ผู้ใช้ที่ยังมีข้อมูล) ==='
SELECT id, username, length(character_data::text) AS json_len
FROM "User" WHERE character_data IS NOT NULL ORDER BY id;
