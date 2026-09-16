\echo == PetState ==
SELECT user_id, pet_type, stage, xp, item_herb, item_kit, item_snack, costume, wardrobe
FROM "PetState" ORDER BY user_id;

\echo == columns present ==
SELECT column_name FROM information_schema.columns
WHERE table_name = 'PetState' AND column_name IN ('item_snack','costume','wardrobe');

\echo == recent attempts ==
SELECT id, student_id, quiz_id, correct, total_q, completed_at
FROM "QuizAttempt" ORDER BY id DESC LIMIT 5;
