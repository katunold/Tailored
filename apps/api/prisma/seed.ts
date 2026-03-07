import { PrismaClient } from '@prisma/client';
import { ItemCategory, OrderStatus } from '../src/domain/enums';

const prisma = new PrismaClient();

type Field = { key: string; label: string; type: 'number' | 'text'; required: boolean };
type SeedOrderItem = {
  itemTypeName: string;
  quantity: number;
  color?: string;
  material?: string;
  measurementOverrides?: Record<string, number>;
};
type SeedOrder = {
  status: (typeof OrderStatus)[keyof typeof OrderStatus];
  dueInDays: number;
  notes?: string;
  items: SeedOrderItem[];
};
type SeedClient = {
  fullName: string;
  phone: string;
  notes?: string;
  profileMeasurements: Record<string, number>;
  orders: SeedOrder[];
};

const templates: Record<string, Field[]> = {
  Alb: [
    { key: 'neck', label: 'Neck', type: 'number', required: true },
    { key: 'cabba', label: 'Cabba', type: 'number', required: true },
    { key: 'sleeves', label: 'Sleeves', type: 'number', required: true },
    { key: 'length', label: 'Length', type: 'number', required: true },
    { key: 'bust', label: 'Bust', type: 'number', required: true },
  ],
  Surplice: [
    { key: 'neck', label: 'Neck', type: 'number', required: true },
    { key: 'cabba', label: 'Cabba', type: 'number', required: true },
    { key: 'sleeves', label: 'Sleeves', type: 'number', required: true },
    { key: 'length', label: 'Length', type: 'number', required: true },
    { key: 'bust', label: 'Bust', type: 'number', required: true },
  ],
  Chasuble: [
    { key: 'neck', label: 'Neck', type: 'number', required: true },
    { key: 'cabba', label: 'Cabba', type: 'number', required: true },
    { key: 'length', label: 'Length', type: 'number', required: true },
  ],
  Dalmatic: [
    { key: 'neck', label: 'Neck', type: 'number', required: true },
    { key: 'cabba', label: 'Cabba', type: 'number', required: true },
    { key: 'length', label: 'Length', type: 'number', required: true },
  ],
  'Clerical Shirt': [
    { key: 'neck', label: 'Neck', type: 'number', required: true },
    { key: 'cabba', label: 'Cabba', type: 'number', required: true },
    { key: 'sleeves', label: 'Sleeves', type: 'number', required: true },
    { key: 'length', label: 'Length', type: 'number', required: true },
    { key: 'bust', label: 'Bust', type: 'number', required: true },
    { key: 'waist', label: 'Waist', type: 'number', required: true },
    { key: 'shoulders', label: 'Shoulders', type: 'number', required: true },
  ],
  'Clerical T-Shirt': [
    { key: 'neck', label: 'Neck', type: 'number', required: true },
    { key: 'cabba', label: 'Cabba', type: 'number', required: true },
    { key: 'sleeves', label: 'Sleeves', type: 'number', required: true },
    { key: 'length', label: 'Length', type: 'number', required: true },
    { key: 'bust', label: 'Bust', type: 'number', required: true },
    { key: 'waist', label: 'Waist', type: 'number', required: true },
    { key: 'shoulders', label: 'Shoulders', type: 'number', required: true },
  ],
  'Dog Collar': [
    { key: 'neck', label: 'Neck', type: 'number', required: true },
    { key: 'cabba', label: 'Cabba', type: 'number', required: true },
    { key: 'sleeves', label: 'Sleeves', type: 'number', required: true },
    { key: 'length', label: 'Length', type: 'number', required: true },
    { key: 'bust', label: 'Bust', type: 'number', required: true },
    { key: 'waist', label: 'Waist', type: 'number', required: true },
    { key: 'shoulders', label: 'Shoulders', type: 'number', required: true },
  ],
  Cassock: [
    { key: 'length', label: 'Length', type: 'number', required: true },
    { key: 'width', label: 'Width', type: 'number', required: true },
  ],
};

const itemTypes = [
  { name: 'Alb', category: ItemCategory.ALB_SURPLICE, defaultColor: 'White', defaultMaterial: 'Cotton' },
  { name: 'Surplice', category: ItemCategory.ALB_SURPLICE, defaultColor: 'White', defaultMaterial: 'Cotton' },
  { name: 'Chasuble', category: ItemCategory.CHASUBLE_DALMATIC, defaultColor: 'Green', defaultMaterial: 'Polyester blend' },
  { name: 'Dalmatic', category: ItemCategory.CHASUBLE_DALMATIC, defaultColor: 'Green', defaultMaterial: 'Polyester blend' },
  { name: 'Clerical Shirt', category: ItemCategory.CLERICAL, defaultColor: 'Black', defaultMaterial: 'Cotton' },
  { name: 'Clerical T-Shirt', category: ItemCategory.CLERICAL, defaultColor: 'Black', defaultMaterial: 'Cotton' },
  { name: 'Dog Collar', category: ItemCategory.CLERICAL, defaultColor: 'White', defaultMaterial: 'Cotton' },
  { name: 'Cassock', category: ItemCategory.OTHER, defaultColor: 'Black', defaultMaterial: 'Polyester blend' },
];

const seedClients: SeedClient[] = [
  {
    fullName: 'Fr. Michael Kamau',
    phone: '+1-202-555-0141',
    notes: 'Prefers breathable fabric for warm seasons.',
    profileMeasurements: {
      neck: 16,
      cabba: 40,
      sleeves: 25,
      length: 58,
      bust: 42,
      waist: 38,
      shoulders: 19,
      width: 22,
    },
    orders: [
      {
        status: OrderStatus.PLACED,
        dueInDays: 14,
        notes: 'Easter season preparation.',
        items: [
          { itemTypeName: 'Chasuble', quantity: 2, color: 'Purple', material: 'Polyester blend' },
          { itemTypeName: 'Alb', quantity: 3, color: 'White', material: 'Cotton' },
        ],
      },
      {
        status: OrderStatus.PROCESSING,
        dueInDays: 7,
        notes: 'Urgent replacement set.',
        items: [
          { itemTypeName: 'Clerical Shirt', quantity: 4, color: 'Black', material: 'Cotton' },
          { itemTypeName: 'Dog Collar', quantity: 4, color: 'White', material: 'Cotton' },
          { itemTypeName: 'Cassock', quantity: 1, color: 'Black', material: 'Polyester blend' },
        ],
      },
    ],
  },
  {
    fullName: 'Rev. Daniel Oduor',
    phone: '+1-202-555-0142',
    notes: 'Sleeves adjusted after last fitting.',
    profileMeasurements: {
      neck: 15,
      cabba: 39,
      sleeves: 24,
      length: 56,
      bust: 40,
      waist: 36,
      shoulders: 18,
      width: 21,
    },
    orders: [
      {
        status: OrderStatus.PAUSED,
        dueInDays: 21,
        notes: 'Awaiting color confirmation.',
        items: [
          { itemTypeName: 'Dalmatic', quantity: 1, color: 'Red', material: 'Polyester blend' },
          { itemTypeName: 'Surplice', quantity: 2, color: 'White', material: 'Cotton' },
        ],
      },
      {
        status: OrderStatus.COMPLETED,
        dueInDays: -10,
        notes: 'Delivered and collected.',
        items: [
          { itemTypeName: 'Clerical T-Shirt', quantity: 3, color: 'Black', material: 'Cotton' },
          { itemTypeName: 'Dog Collar', quantity: 3, color: 'White', material: 'Cotton' },
        ],
      },
    ],
  },
  {
    fullName: 'Fr. Peter Njoroge',
    phone: '+1-202-555-0143',
    notes: 'Usually orders in bundles per quarter.',
    profileMeasurements: {
      neck: 17,
      cabba: 42,
      sleeves: 26,
      length: 60,
      bust: 44,
      waist: 40,
      shoulders: 20,
      width: 23,
    },
    orders: [
      {
        status: OrderStatus.CANCELED,
        dueInDays: 5,
        notes: 'Client postponed the event.',
        items: [
          { itemTypeName: 'Alb', quantity: 1, color: 'White', material: 'Cotton' },
          { itemTypeName: 'Cassock', quantity: 1, color: 'Black', material: 'Polyester blend' },
        ],
      },
      {
        status: OrderStatus.PLACED,
        dueInDays: 30,
        notes: 'Quarterly stock refill.',
        items: [
          { itemTypeName: 'Clerical Shirt', quantity: 6, color: 'Black', material: 'Cotton' },
          { itemTypeName: 'Clerical T-Shirt', quantity: 4, color: 'Black', material: 'Cotton' },
          {
            itemTypeName: 'Dog Collar',
            quantity: 8,
            color: 'White',
            material: 'Cotton',
            measurementOverrides: { neck: 17.5 },
          },
        ],
      },
    ],
  },
];

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toMeasurementSnapshot(
  fields: Field[] | undefined,
  profileValues: Record<string, number>,
  overrides: Record<string, number> | undefined
): Record<string, number> {
  const source = { ...profileValues, ...(overrides ?? {}) };
  const keys = (fields ?? []).map((f) => f.key);

  return keys.reduce<Record<string, number>>((acc, key) => {
    const value = source[key];
    if (Number.isFinite(value)) {
      acc[key] = Number(value);
    }
    return acc;
  }, {});
}

async function main(): Promise<void> {
  await prisma.setting.upsert({
    where: { key: 'default_unit' },
    update: {},
    create: { key: 'default_unit', value: 'cm' },
  });

  const itemTypeByName = new Map<string, { id: number; name: string }>();
  const defaultByItemTypeId = new Map<number, { defaultColor: string; defaultMaterial: string }>();

  for (const itemType of itemTypes) {
    const created = await prisma.itemType.upsert({
      where: { name: itemType.name },
      update: {
        category: itemType.category,
        isActive: true,
      },
      create: {
        name: itemType.name,
        category: itemType.category,
        isActive: true,
      },
    });

    await prisma.itemTypeDefaults.upsert({
      where: { itemTypeId: created.id },
      update: {
        defaultColor: itemType.defaultColor,
        defaultMaterial: itemType.defaultMaterial,
      },
      create: {
        itemTypeId: created.id,
        defaultColor: itemType.defaultColor,
        defaultMaterial: itemType.defaultMaterial,
      },
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

    itemTypeByName.set(itemType.name, { id: created.id, name: created.name });
    defaultByItemTypeId.set(created.id, {
      defaultColor: itemType.defaultColor,
      defaultMaterial: itemType.defaultMaterial,
    });
  }

  for (const seedClient of seedClients) {
    const client = await prisma.client.upsert({
      where: { phone: seedClient.phone },
      update: {
        fullName: seedClient.fullName,
        notes: seedClient.notes ?? null,
      },
      create: {
        fullName: seedClient.fullName,
        phone: seedClient.phone,
        notes: seedClient.notes ?? null,
      },
    });

    // Deterministic reseed for sample clients.
    await prisma.order.deleteMany({ where: { clientId: client.id } });
    await prisma.currentMeasurement.deleteMany({ where: { clientId: client.id } });

    for (const itemType of itemTypes) {
      const dbItemType = itemTypeByName.get(itemType.name);
      if (!dbItemType) continue;

      const values = toMeasurementSnapshot(templates[itemType.name], seedClient.profileMeasurements, undefined);
      await prisma.currentMeasurement.create({
        data: {
          clientId: client.id,
          itemTypeId: dbItemType.id,
          valuesJson: JSON.stringify(values),
        },
      });
    }

    const now = new Date();
    for (const seedOrder of seedClient.orders) {
      const order = await prisma.order.create({
        data: {
          clientId: client.id,
          status: seedOrder.status,
          dueDate: addDays(now, seedOrder.dueInDays),
          notes: seedOrder.notes ?? null,
        },
      });

      for (const item of seedOrder.items) {
        const itemType = itemTypeByName.get(item.itemTypeName);
        if (!itemType) {
          throw new Error(`Missing item type for order seed: ${item.itemTypeName}`);
        }

        const defaults = defaultByItemTypeId.get(itemType.id);
        if (!defaults) {
          throw new Error(`Missing defaults for item type: ${item.itemTypeName}`);
        }

        const measurementSnapshot = toMeasurementSnapshot(
          templates[item.itemTypeName],
          seedClient.profileMeasurements,
          item.measurementOverrides
        );

        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            itemTypeId: itemType.id,
            quantity: item.quantity,
            color: item.color ?? defaults.defaultColor,
            material: item.material ?? defaults.defaultMaterial,
            measurementSnapshotJson: JSON.stringify(measurementSnapshot),
            notes: null,
          },
        });
      }
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
