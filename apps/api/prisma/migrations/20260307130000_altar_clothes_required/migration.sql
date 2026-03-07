-- Make Altar clothes fields required.
INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[{"key":"length","label":"Length","type":"number","required":true},{"key":"width","label":"Width","type":"number","required":true}]'
FROM "item_types"
WHERE "name" = 'Altar clothes'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";
