import { Router } from "express";
import { AppContext } from "../app.ts";
import { CreateOrderSchema, UpdateOrderStatusSchema } from "../validation/schemas.ts";

function cleanText(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

export function ordersRouter(ctx: AppContext) {
  const route = Router();
  const parseId = (value: string): number | null => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  route.get("/", async (req, res) => {
    const q = String(req.query.query || "").trim();
    const status = String(req.query.status || "").trim();
    const clientIdRaw = String(req.query.clientId || "").trim();
    const clientId = clientIdRaw ? parseId(clientIdRaw) : null;
    if (clientIdRaw && clientId === null) {
      return res.status(400).json({ error: "Invalid client id" });
    }
    const queryAsId = parseId(q);

    const orders = await ctx.prisma.order.findMany({
      where: {
        ...(clientId !== null ? { clientId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(q
          ? {
              OR: [
                ...(queryAsId !== null ? [{ id: queryAsId }] : []),
                { client: { fullName: { contains: q } } },
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
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid order id" });
    const order = await ctx.prisma.order.findUnique({
      where: { id },
      include: { client: true, items: { include: { itemType: true } } },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    // parse snapshot json for convenience
    const items = order.items.map((i: any) => ({
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
    const defaultsByType = new Map<number, { defaultColor?: string; defaultMaterial?: string }>(
      defaults.map((d: any) => [d.itemTypeId, d])
    );

    // prefetch measurement template fields per item type
    const templates = await ctx.prisma.measurementTemplate.findMany({
      where: { itemTypeId: { in: itemTypeIds } },
      select: { itemTypeId: true, fieldsJson: true },
    });
    const templateFieldsByType = new Map<number, Array<{ key: string; required?: boolean }>>(
      templates.map((t: any) => [t.itemTypeId, JSON.parse(t.fieldsJson)])
    );

    // get current client profile values once, then simulate order item flow to validate missing fields
    const profileRows = (await ctx.prisma.$queryRawUnsafe(
      `SELECT values_json FROM client_measurement_profiles WHERE client_id = ? LIMIT 1`,
      dto.clientId
    )) as Array<{ values_json: string }>;
    const existingProfile = profileRows[0] ?? null;
    const baseProfileValues = existingProfile ? (JSON.parse(existingProfile.values_json) as Record<string, number>) : {};
    let workingProfileValues: Record<string, number> = { ...baseProfileValues };
    const missingByItem: Array<{ itemTypeId: number; missingFields: string[] }> = [];

    for (const item of dto.items) {
      const useCurrent = item.useCurrentMeasurements === true;
      const inputValues = item.measurementsInput ?? {};
      const hasInputValues = Object.keys(inputValues).length > 0;
      const candidateValues = useCurrent
        ? { ...workingProfileValues, ...inputValues }
        : { ...inputValues };

      const templateFields = templateFieldsByType.get(item.itemTypeId) ?? [];
      const requiredKeys = templateFields
        .filter((f) => Boolean(f.required))
        .map((f) => f.key);

      const missingFields = requiredKeys.filter((key) => {
        const value = candidateValues[key];
        return value === null || value === undefined || !Number.isFinite(Number(value));
      });

      if (missingFields.length > 0) {
        missingByItem.push({ itemTypeId: item.itemTypeId, missingFields });
      }

      if (hasInputValues) {
        workingProfileValues = candidateValues;
      }
    }

    if (missingByItem.length > 0) {
      return res.status(400).json({
        error: "Missing required measurements for one or more items.",
        missingByItem,
      });
    }

    const created = await ctx.prisma.$transaction(async (tx: any) => {
      // Create order
      const order = await tx.order.create({
        data: {
          clientId: dto.clientId,
          status: dto.status,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes ?? null,
        },
      });

      let profileValues: Record<string, number> = { ...baseProfileValues };
      let hasProfileUpdates = false;

      // For each item, resolve measurements + snapshot + defaults
      for (const item of dto.items) {
        const d = defaultsByType.get(item.itemTypeId);

        const color = cleanText(item.color) ?? d?.defaultColor ?? "Default";
        const material = cleanText(item.material) ?? d?.defaultMaterial ?? "Standard";
        const useCurrent = item.useCurrentMeasurements === true;
        const inputValues = item.measurementsInput ?? {};
        const hasInputValues = Object.keys(inputValues).length > 0;
        const sourceValues = useCurrent
          ? { ...profileValues, ...inputValues }
          : { ...inputValues };

        if (hasInputValues) {
          profileValues = { ...profileValues, ...inputValues };
          hasProfileUpdates = true;
        }

        const templateFields = templateFieldsByType.get(item.itemTypeId) ?? [];
        const relevantKeys = templateFields.map((f) => f.key);
        const measurementSnapshot = relevantKeys.reduce<Record<string, number>>((acc, key) => {
          const value = sourceValues[key];
          if (value !== undefined && value !== null && Number.isFinite(Number(value))) {
            acc[key] = Number(value);
          }
          return acc;
        }, {});

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            itemTypeId: item.itemTypeId,
            quantity: item.quantity ?? 1,
            color,
            material,
            measurementSnapshotJson: JSON.stringify(measurementSnapshot),
            notes: null,
          },
        });
      }

      if (hasProfileUpdates) {
        await tx.$executeRawUnsafe(
          `INSERT INTO client_measurement_profiles (client_id, values_json, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(client_id)
           DO UPDATE SET values_json = excluded.values_json, updated_at = CURRENT_TIMESTAMP`,
          dto.clientId,
          JSON.stringify(profileValues)
        );
      }

      return order;
    });

    res.status(201).json({ id: created.id });
  });

  route.put("/:id/status", async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid order id" });
    const dto = UpdateOrderStatusSchema.parse(req.body);

    const updated = await ctx.prisma.order.update({
      where: { id },
      data: { status: dto.status },
    });

    res.json(updated);
  });

  route.delete("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid order id" });

    await ctx.prisma.order.delete({ where: { id } });
    res.status(204).send();
  });

  return route;
}
