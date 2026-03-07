-- Altar clothes, Amice, Stole, Cincture should only have optional Notes field.
INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[{"key":"notes","label":"Notes","type":"text","required":false}]'
FROM "item_types"
WHERE "name" IN ('Altar clothes', 'Amice', 'Stole', 'Cincture')
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";
