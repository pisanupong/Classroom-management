\echo '=== ฐานข้อมูลที่กำลังคุยด้วย ==='
SELECT current_database(), current_user, inet_server_port();

\echo '=== คอลัมน์ของ PetState (ดูว่า push schema แล้วหรือยัง) ==='
SELECT column_name FROM information_schema.columns
WHERE table_name = 'PetState' ORDER BY ordinal_position;

\echo '=== จำนวนคำที่ค้างอยู่ ==='
SELECT count(*) AS total_words FROM "PetWord";

\echo '=== 10 คำล่าสุด ==='
SELECT word, used_by, used_at FROM "PetWord" ORDER BY used_at DESC LIMIT 10;

\echo '=== สถานะสัตว์เลี้ยง ==='
SELECT user_id, pet_name, xp, total_words, hunger, stage FROM "PetState" ORDER BY user_id;
