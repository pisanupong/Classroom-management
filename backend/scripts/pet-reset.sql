-- รีเซ็ตระบบสัตว์เลี้ยง: ล้างคำศัพท์ทั้งหมด + ส่งสัตว์เลี้ยงทุกตัวกลับเป็นไข่
-- คงไว้: element (ธาตุ), atk_lv, atk_xp, pvp_wins, pvp_losses, pet_name, pet_type
BEGIN;

DELETE FROM "PetWord";

UPDATE "PetState" SET
  xp          = 0,
  total_words = 0,
  hunger      = 60,
  stage       = 'EGG',
  health      = 'healthy',
  rest_until  = NULL;

COMMIT;

-- ตรวจผล
SELECT count(*) AS remaining_words FROM "PetWord";
SELECT user_id, pet_name, xp, total_words, stage, element, atk_lv, pvp_wins, pvp_losses
FROM "PetState" ORDER BY user_id;
