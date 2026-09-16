\echo '=== character_data ของแต่ละผู้ใช้ ==='
SELECT id, username, name,
       (character_data IS NULL) AS is_null,
       length(character_data::text) AS json_len,
       left(character_data::text, 200) AS preview
FROM "User" ORDER BY id;
