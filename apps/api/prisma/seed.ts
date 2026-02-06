import { PrismaClient } from '@prisma/client';
import { ItemCategory } from "../src/domain/enums";

const prisma = new PrismaClient();

type Field = { key: string; label: string; type: "number" | "text"; required: boolean };

const templates: Record<string, Field[]> = {
  "Alb": [
    { key: "neck", label: "Neck", type: "number", required: true },
    { key: "cabba", label: "Cabba", type: "number", required: true },
    { key: "sleeves", label: "Sleeves", type: "number", required: true },
    { key: "length", label: "Length", type: "number", required: true },
    { key: "bust", label: "Bust", type: "number", required: true },
  ],
  "Surplice": [
    { key: "neck", label: "Neck", type: "number", required: true },
    { key: "cabba", label: "Cabba", type: "number", required: true },
    { key: "sleeves", label: "Sleeves", type: "number", required: true },
    { key: "length", label: "Length", type: "number", required: true },
    { key: "bust", label: "Bust", type: "number", required: true },
  ],
  "Chasuble": [
    { key: "neck", label: "Neck", type: "number", required: true },
    { key: "cabba", label: "Cabba", type: "number", required: true },
    { key: "length", label: "Length", type: "number", required: true },
  ],
  "Dalmatic": [
    { key: "neck", label: "Neck", type: "number", required: true },
    { key: "cabba", label: "Cabba", type: "number", required: true },
    { key: "length", label: "Length", type: "number", required: true },
  ],
  "Clerical Shirt": [
    { key: "neck", label: "Neck", type: "number", required: true },
    { key: "cabba", label: "Cabba", type: "number", required: true },
    { key: "sleeves", label: "Sleeves", type: "number", required: true },
    { key: "length", label: "Length", type: "number", required: true },
    { key: "bust", label: "Bust", type: "number", required: true },
    { key: "waist", label: "Waist", type: "number", required: true },
    { key: "shoulders", label: "Shoulders", type: "number", required: true },
  ],
  "Clerical T-Shirt": [
    { key: "neck", label: "Neck", type: "number", required: true },
    { key: "cabba", label: "Cabba", type: "number", required: true },
    { key: "sleeves", label: "Sleeves", type: "number", required: true },
    { key: "length", label: "Length", type: "number", required: true },
    { key: "bust", label: "Bust", type: "number", required: true },
    { key: "waist", label: "Waist", type: "number", required: true },
    { key: "shoulders", label: "Shoulders", type: "number", required: true },
  ],
  "Dog Collar": [
    { key: "neck", label: "Neck", type: "number", required: true },
    { key: "cabba", label: "Cabba", type: "number", required: true },
    { key: "sleeves", label: "Sleeves", type: "number", required: true },
    { key: "length", label: "Length", type: "number", required: true },
    { key: "bust", label: "Bust", type: "number", required: true },
    { key: "waist", label: "Waist", type: "number", required: true },
    { key: "shoulders", label: "Shoulders", type: "number", required: true },
  ],
  "Cassock": [
    { key: "length", label: "Length", type: "number", required: true },
    { key: "width", label: "Width", type: "number", required: true },
  ],
};

const itemTypes = [
  { name: "Alb", category: ItemCategory.ALB_SURPLICE, defaultColor: "White", defaultMaterial: "Cotton" },
  { name: "Surplice", category: ItemCategory.ALB_SURPLICE, defaultColor: "White", defaultMaterial: "Cotton" },
  { name: "Chasuble", category: ItemCategory.CHASUBLE_DALMATIC, defaultColor: "Green", defaultMaterial: "Polyester blend" },
  { name: "Dalmatic", category: ItemCategory.CHASUBLE_DALMATIC, defaultColor: "Green", defaultMaterial: "Polyester blend" },
  { name: "Clerical Shirt", category: ItemCategory.CLERICAL, defaultColor: "Black", defaultMaterial: "Cotton" },
  { name: "Clerical T-Shirt", category: ItemCategory.CLERICAL, defaultColor: "Black", defaultMaterial: "Cotton" },
  { name: "Dog Collar", category: ItemCategory.CLERICAL, defaultColor: "White", defaultMaterial: "Cotton" },
  { name: "Cassock", category: ItemCategory.OTHER, defaultColor: "Black", defaultMaterial: "Polyester blend" },
];

async function main(): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "default_unit" },
    update: {},
    create: { key: "default_unit", value: "cm" },
  });

  for (const itemType of itemTypes) {
    const created = await prisma.itemType.upsert({
      where: { name: itemType.name },
      update: {
        category: itemType.category,
        isActive: true 
      },
      create: {
        name: itemType.name,
        category: itemType.category,
        isActive: true
      },
    });

    await prisma.itemTypeDefaults.upsert({
      where: { itemTypeId: created.id },
      update: {
        defaultColor: itemType.defaultColor,
        defaultMaterial: itemType.defaultMaterial
      },
      create: {
        itemTypeId: created.id,
        defaultColor: itemType.defaultColor,
        defaultMaterial: itemType.defaultMaterial
      }
    });

    const fields = templates[itemType.name];
    if (fields) {
      await prisma.measurementTemplate.upsert({
        where: { itemTypeId: created.id },
        update: {
          fieldsJson: JSON.stringify(fields),
        },
        create: {
          itemTypeId: created.id,
          fieldsJson: JSON.stringify(fields),
        },
      });
    } 
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
