-- Add new product types and refresh measurement templates/defaults.

INSERT INTO "item_types" ("name", "category", "is_active") VALUES
  ('Mappa', 'OTHER', 1),
  ('Cope', 'CHASUBLE_DALMATIC', 1),
  ('Altar servers vestments', 'ALB_SURPLICE', 1),
  ('Catechists'' vestments', 'ALB_SURPLICE', 1),
  ('Altar clothes', 'OTHER', 1),
  ('Amice', 'OTHER', 1),
  ('Stole', 'OTHER', 1),
  ('Cincture', 'OTHER', 1),
  ('Others', 'OTHER', 1)
ON CONFLICT("name") DO UPDATE SET
  "category" = excluded."category",
  "is_active" = 1;

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Polyester blend', 'Green' FROM "item_types" WHERE "name" = 'Chasuble'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Polyester blend', 'Green' FROM "item_types" WHERE "name" = 'Dalmatic'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Polyester blend', 'Black' FROM "item_types" WHERE "name" = 'Cassock'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Cotton', 'White' FROM "item_types" WHERE "name" = 'Mappa'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Polyester blend', 'White' FROM "item_types" WHERE "name" = 'Cope'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Cotton', 'White' FROM "item_types" WHERE "name" = 'Altar servers vestments'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Cotton', 'White' FROM "item_types" WHERE "name" = 'Catechists'' vestments'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Cotton', 'White' FROM "item_types" WHERE "name" = 'Altar clothes'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Cotton', 'White' FROM "item_types" WHERE "name" = 'Amice'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Polyester blend', 'White' FROM "item_types" WHERE "name" = 'Stole'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Cotton', 'White' FROM "item_types" WHERE "name" = 'Cincture'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "item_type_defaults" ("item_type_id", "default_material", "default_color")
SELECT "id", 'Standard', 'Default' FROM "item_types" WHERE "name" = 'Others'
ON CONFLICT("item_type_id") DO UPDATE SET
  "default_material" = excluded."default_material",
  "default_color" = excluded."default_color";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[{"key":"neck","label":"Neck","type":"number","required":true},{"key":"cabba","label":"Cabba","type":"number","required":true},{"key":"sleeves","label":"Sleeves","type":"number","required":false},{"key":"length","label":"Length","type":"number","required":true}]'
FROM "item_types" WHERE "name" = 'Chasuble'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[{"key":"neck","label":"Neck","type":"number","required":true},{"key":"cabba","label":"Cabba","type":"number","required":true},{"key":"sleeves","label":"Sleeves","type":"number","required":false},{"key":"length","label":"Length","type":"number","required":true}]'
FROM "item_types" WHERE "name" = 'Dalmatic'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[{"key":"neck","label":"Neck","type":"number","required":true},{"key":"cabba","label":"Cabba","type":"number","required":true},{"key":"sleeves","label":"Sleeves","type":"number","required":true},{"key":"shoulders","label":"Shoulders","type":"number","required":true},{"key":"waist","label":"Waist","type":"number","required":true},{"key":"bust","label":"Bust","type":"number","required":true},{"key":"length","label":"Length","type":"number","required":true},{"key":"kakooti","label":"Kakooti","type":"number","required":true}]'
FROM "item_types" WHERE "name" = 'Cassock'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[{"key":"length","label":"Length","type":"number","required":true},{"key":"width","label":"Width","type":"number","required":true}]'
FROM "item_types" WHERE "name" = 'Mappa'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[{"key":"cabba","label":"Cabba","type":"number","required":true},{"key":"neck","label":"Neck","type":"number","required":true},{"key":"bust","label":"Bust","type":"number","required":true},{"key":"length","label":"Length","type":"number","required":true}]'
FROM "item_types" WHERE "name" = 'Cope'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[{"key":"neck","label":"Neck","type":"number","required":true},{"key":"cabba","label":"Cabba","type":"number","required":true},{"key":"sleeves","label":"Sleeves","type":"number","required":true},{"key":"length","label":"Length","type":"number","required":true},{"key":"bust","label":"Bust","type":"number","required":true}]'
FROM "item_types" WHERE "name" = 'Altar servers vestments'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[{"key":"neck","label":"Neck","type":"number","required":true},{"key":"cabba","label":"Cabba","type":"number","required":true},{"key":"sleeves","label":"Sleeves","type":"number","required":true},{"key":"length","label":"Length","type":"number","required":true},{"key":"bust","label":"Bust","type":"number","required":true}]'
FROM "item_types" WHERE "name" = 'Catechists'' vestments'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[]' FROM "item_types" WHERE "name" = 'Altar clothes'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[]' FROM "item_types" WHERE "name" = 'Amice'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[]' FROM "item_types" WHERE "name" = 'Stole'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[]' FROM "item_types" WHERE "name" = 'Cincture'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";

INSERT INTO "measurement_templates" ("item_type_id", "fields_json")
SELECT "id", '[]' FROM "item_types" WHERE "name" = 'Others'
ON CONFLICT("item_type_id") DO UPDATE SET "fields_json" = excluded."fields_json";
