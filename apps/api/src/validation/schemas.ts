import { z } from "zod";

export const OrderStatusSchema = z.enum(["PLACED", "PROCESSING", "PAUSED", "COMPLETED", "CANCELED"]);

export const CreateClientSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(5),
  notes: z.string().optional().nullable(),
});

export const UpdateClientSchema = CreateClientSchema.partial();

export const MeasurementValuesSchema = z.record(z.string(), z.number());

export const UpsertCurrentMeasurementSchema = z.object({
  values: MeasurementValuesSchema, // already converted to DB unit by UI OR backend converts
});

export const CreateOrderItemSchema = z.object({
  itemTypeId: z.coerce.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
  color: z.string().optional(),    // may be blank -> backend defaults
  material: z.string().optional(), // may be blank -> backend defaults

  useCurrentMeasurements: z.boolean().optional(),
  measurementsInput: MeasurementValuesSchema.optional(),
}).superRefine((v, ctx) => {
  // Manual mode requires explicit measurements input.
  if (v.useCurrentMeasurements === false && !v.measurementsInput) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide measurementsInput when useCurrentMeasurements=false",
      path: ["measurementsInput"],
    });
  }

  // If mode is omitted, treat as manual and require measurements input.
  if (v.useCurrentMeasurements === undefined && !v.measurementsInput) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide useCurrentMeasurements=true or measurementsInput",
      path: ["useCurrentMeasurements"],
    });
  }
});

export const CreateOrderSchema = z.object({
  clientId: z.coerce.number().int().positive(),
  status: OrderStatusSchema.default("PLACED"),
  dueDate: z.string().datetime().optional(), // ISO string
  notes: z.string().optional().nullable(),
  items: z.array(CreateOrderItemSchema).min(1),
});

export const UpdateOrderStatusSchema = z.object({
  status: OrderStatusSchema,
});
