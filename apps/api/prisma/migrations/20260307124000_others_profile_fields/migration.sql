-- Add text-based client profile fields for Others in measurement template.
INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[{"key":"productName","label":"Product Name","type":"text","required":true},{"key":"notes","label":"Notes","type":"text","required":false}]'
FROM "item_types"
WHERE "name" = 'Others'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";
