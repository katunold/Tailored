import { Router } from "express";
import { AppContext } from "../app.ts";
import { CreateOrderSchema, UpdateOrderStatusSchema } from "../validation/schemas.ts";

function cleanText(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

export function ordersRouter(ctx: AppContext) {
  const route = Router();

  route.get("/", async (req, res) => {
    const q = String(req.query.query || "").trim();
    const status = String(req.query.status || "").trim();

    const orders = await ctx.prisma.order.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(q
          ? {
              OR: [
                { id: { contains: q } },
                { client: { fullName: { contains: q, mode: "insensitive" } } },
                { client: { phone: { contains: q } } },
              ],
            }
          : {}),
      },
      include: { client: true, items: { include: { itemType: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(orders);
  });

  route.get("/:id", async (req, res) => {
    const id = req.params.id;
    const order = await ctx.prisma.order.findUnique({
      where: { id },
      include: { client: true, items: { include: { itemType: true } } },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    // parse snapshot json for convenience
    const items = order.items.map((i: { measurementSnapshotJson: string; }) => ({
      ...i,
      measurementSnapshot: JSON.parse(i.measurementSnapshotJson),
    }));

    res.json({ ...order, items });
  });

  route.post("/", async (req, res) => {
    const dto = CreateOrderSchema.parse(req.body);

    // prefetch item type defaults (to default color/material per item type)
    const itemTypeIds = [...new Set(dto.items.map((i) => i.itemTypeId))];
    const defaults = await ctx.prisma.itemTypeDefaults.findMany({
      where: { itemTypeId: { in: itemTypeIds } },
    });
    const defaultsByType = new Map<string, { defaultColor?: string; defaultMaterial?: string }>(
      defaults.map((d: { itemTypeId: string; defaultColor?: string; defaultMaterial?: string }) => [d.itemTypeId, d])
    );

    const created = await ctx.prisma.$transaction(async (tx: { order: { create: (arg0: { data: { clientId: string; status: "PLACED" | "PROCESSING" | "PAUSED" | "COMPLETED" | "CANCELED"; dueDate: Date | null; notes: string | null; }; }) => any; }; currentMeasurement: { upsert: (arg0: { where: { clientId_itemTypeId: { clientId: string; itemTypeId: string; }; }; update: { valuesJson: string; }; create: { clientId: string; itemTypeId: string; valuesJson: string; }; }) => any; findUnique: (arg0: { where: { clientId_itemTypeId: { clientId: string; itemTypeId: string; }; }; }) => any; }; orderItem: { create: (arg0: { data: { orderId: any; itemTypeId: string; quantity: number; color: any; material: any; measurementSnapshotJson: string; notes: null; }; }) => any; }; }) => {
      // Create order
      const order = await tx.order.create({
        data: {
          clientId: dto.clientId,
          status: dto.status,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes ?? null,
        },
      });

      // For each item, resolve measurements + snapshot + defaults
      for (const item of dto.items) {
        const d = defaultsByType.get(item.itemTypeId);

        const color = cleanText(item.color) ?? d?.defaultColor ?? "Default";
        const material = cleanText(item.material) ?? d?.defaultMaterial ?? "Standard";

        let measurementValues: Record<string, number>;

        if (item.measurementsInput) {
          // store/update current measurements using input
          measurementValues = item.measurementsInput;

          await tx.currentMeasurement.upsert({
            where: {
              clientId_itemTypeId: { clientId: dto.clientId, itemTypeId: item.itemTypeId },
            },
            update: { valuesJson: JSON.stringify(measurementValues) },
            create: { clientId: dto.clientId, itemTypeId: item.itemTypeId, valuesJson: JSON.stringify(measurementValues) },
          });
        } else {
          // use current measurements
          const current = await tx.currentMeasurement.findUnique({
            where: { clientId_itemTypeId: { clientId: dto.clientId, itemTypeId: item.itemTypeId } },
          });

          if (!current) {
            throw new Error(`Missing current measurements for itemTypeId=${item.itemTypeId}. Provide measurementsInput.`);
          }

          measurementValues = JSON.parse(current.valuesJson);
        }

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            itemTypeId: item.itemTypeId,
            quantity: item.quantity ?? 1,
            color,
            material,
            measurementSnapshotJson: JSON.stringify(measurementValues),
            notes: null,
          },
        });
      }

      return order;
    });

    res.status(201).json({ id: created.id });
  });

  route.put("/:id/status", async (req, res) => {
    const id = req.params.id;
    const dto = UpdateOrderStatusSchema.parse(req.body);

    const updated = await ctx.prisma.order.update({
      where: { id },
      data: { status: dto.status },
    });

    res.json(updated);
  });

  return route;
}
