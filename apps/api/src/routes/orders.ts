import { Router } from "express";
import { AppContext } from "../app.ts";
import { CreateOrderSchema, UpdateOrderPersonnelSchema, UpdateOrderStatusSchema } from "../validation/schemas.ts";

function cleanText(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

function hasRecordedProfileValues(values: Record<string, number | string>): boolean {
  return Object.keys(values).length > 0;
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
      notes: cleanText(i.notes),
    }));

    res.json({ ...order, items });
  });

  route.post("/", async (req, res) => {
    const dto = CreateOrderSchema.parse(req.body);
    const receivedBy = cleanText(dto.receivedBy);
    const assignedTo = cleanText(dto.assignedTo);
    if (!receivedBy || !assignedTo) {
      return res.status(400).json({ error: "Received By and Assigned To are required." });
    }

    // prefetch item type defaults (to default color/material per item type)
    const itemTypeIds = [...new Set(dto.items.map((i) => i.itemTypeId))];
    const itemTypes = await ctx.prisma.itemType.findMany({
      where: { id: { in: itemTypeIds } },
      select: { id: true, name: true },
    });
    const itemTypeNameById = new Map<number, string>(itemTypes.map((itemType) => [itemType.id, itemType.name]));

    if (itemTypes.length !== itemTypeIds.length) {
      return res.status(400).json({ error: "One or more item types are invalid." });
    }

    const allItemTypeNames = await ctx.prisma.itemType.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    const normalizedExistingNames = new Set(
      allItemTypeNames.map((itemType) => itemType.name.trim().toLowerCase())
    );

    for (const item of dto.items) {
      const itemTypeName = itemTypeNameById.get(item.itemTypeId) ?? "";
      const isOthers = itemTypeName.trim().toLowerCase() === "others";
      if (!isOthers) continue;

      const otherProductName = cleanText(item.otherProductName);
      if (!otherProductName) {
        return res.status(400).json({ error: "Product name is required for Others." });
      }

      if (normalizedExistingNames.has(otherProductName.toLowerCase())) {
        return res.status(400).json({
          error: "Product exists and not under others.",
        });
      }
    }

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

    // Get current measurements per item type, then simulate order item flow to validate required fields.
    const currentRows = await ctx.prisma.currentMeasurement.findMany({
      where: { clientId: dto.clientId, itemTypeId: { in: itemTypeIds } },
      select: { itemTypeId: true, valuesJson: true },
    });
    const baseValuesByType = new Map<number, Record<string, number | string>>();
    for (const row of currentRows) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.valuesJson);
      } catch {
        parsed = {};
      }
      const values = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, number | string>)
        : {};
      baseValuesByType.set(row.itemTypeId, values);
    }

    const workingValuesByType = new Map<number, Record<string, number | string>>(baseValuesByType);
    const missingByItem: Array<{ itemTypeId: number; missingFields: string[] }> = [];

    for (const item of dto.items) {
      const existingValues = workingValuesByType.get(item.itemTypeId) ?? {};
      const useCurrent = item.useCurrentMeasurements === true;
      const inputValues = item.measurementsInput ?? {};
      const hasInputValues = Object.keys(inputValues).length > 0;
      const shouldPromoteManualInputToProfile =
        !useCurrent && !hasRecordedProfileValues(existingValues) && hasInputValues;
      const candidateValues = useCurrent
        ? { ...existingValues, ...inputValues }
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

      if ((useCurrent && hasInputValues) || shouldPromoteManualInputToProfile) {
        workingValuesByType.set(item.itemTypeId, candidateValues);
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
          receivedBy,
          assignedTo,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes ?? null,
        },
      });

      const updatedValuesByType = new Map<number, Record<string, number | string>>(baseValuesByType);

      // For each item, resolve measurements + snapshot + defaults
      for (const item of dto.items) {
        const existingValues = updatedValuesByType.get(item.itemTypeId) ?? {};
        const d = defaultsByType.get(item.itemTypeId);
        const itemTypeName = itemTypeNameById.get(item.itemTypeId) ?? "";
        const isOthers = itemTypeName.trim().toLowerCase() === "others";

        const color = cleanText(item.color) ?? d?.defaultColor ?? "Default";
        const material = cleanText(item.material) ?? d?.defaultMaterial ?? "Standard";
        const useCurrent = item.useCurrentMeasurements === true;
        const inputValues = item.measurementsInput ?? {};
        const hasInputValues = Object.keys(inputValues).length > 0;
        const shouldPromoteManualInputToProfile =
          !useCurrent && !hasRecordedProfileValues(existingValues) && hasInputValues;
        const sourceValues = useCurrent
          ? { ...existingValues, ...inputValues }
          : { ...inputValues };

        if (useCurrent && hasInputValues) {
          updatedValuesByType.set(item.itemTypeId, { ...existingValues, ...inputValues });
        } else if (shouldPromoteManualInputToProfile) {
          updatedValuesByType.set(item.itemTypeId, { ...inputValues });
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
        const otherProductName = cleanText(item.otherProductName);
        const itemNotes = cleanText(item.itemNotes);
        const notes = isOthers && otherProductName
          ? itemNotes
            ? `Others product: ${otherProductName}\n${itemNotes}`
            : `Others product: ${otherProductName}`
          : itemNotes;

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            itemTypeId: item.itemTypeId,
            quantity: item.quantity ?? 1,
            color,
            material,
            measurementSnapshotJson: JSON.stringify(measurementSnapshot),
            notes,
          },
        });
      }

      const toPersist = Array.from(updatedValuesByType.entries())
        .filter(([itemTypeId, values]) => {
          const base = baseValuesByType.get(itemTypeId) ?? {};
          return JSON.stringify(base) !== JSON.stringify(values);
        });

      for (const [itemTypeId, values] of toPersist) {
        await tx.$executeRawUnsafe(
          `INSERT INTO current_measurements (client_id, item_type_id, values_json, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(client_id, item_type_id)
           DO UPDATE SET values_json = excluded.values_json, updated_at = CURRENT_TIMESTAMP`,
          dto.clientId,
          itemTypeId,
          JSON.stringify(values)
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

  route.put("/:id/personnel", async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid order id" });
    const dto = UpdateOrderPersonnelSchema.parse(req.body);
    const receivedBy = cleanText(dto.receivedBy);
    const assignedTo = cleanText(dto.assignedTo);
    if (!receivedBy || !assignedTo) {
      return res.status(400).json({ error: "Received By and Assigned To are required." });
    }

    await ctx.prisma.$executeRawUnsafe(
      `UPDATE orders
       SET received_by = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      receivedBy,
      assignedTo,
      id
    );

    const updated = await ctx.prisma.order.findUnique({ where: { id } });
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
