import { z } from "zod";

const PhoneSchema = z
  .string()
  .trim()
  .refine((value) => /^\+?[0-9]{7,15}$/.test(value), {
    message: "Phone must be 7 to 15 digits, with optional leading +",
  });

export const OrderStatusSchema = z.enum(["PLACED", "PROCESSING", "PAUSED", "COMPLETED", "CANCELED"]);

export const CreateClientSchema = z.object({
  fullName: z.string().min(2),
  phone: PhoneSchema,
  notes: z.string().optional().nullable(),
});

export const UpdateClientSchema = CreateClientSchema.partial();

export const MeasurementValuesSchema = z.record(z.string(), z.number());
export const ProfileMeasurementValuesSchema = z.record(z.string(), z.union([z.number(), z.string()]));

export const UpsertCurrentMeasurementSchema = z.object({
  values: ProfileMeasurementValuesSchema,
});

export const CreateOrderItemSchema = z.object({
  itemTypeId: z.coerce.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
  color: z.string().optional(),    // may be blank -> backend defaults
  material: z.string().optional(), // may be blank -> backend defaults
  itemNotes: z.string().optional().nullable(),
  otherProductName: z.string().optional().nullable(),

  useCurrentMeasurements: z.boolean().optional(),
  measurementsInput: ProfileMeasurementValuesSchema.optional(),
});

export const CreateOrderSchema = z.object({
  clientId: z.coerce.number().int().positive(),
  status: OrderStatusSchema.default("PLACED"),
  receivedBy: z.string().trim().min(1),
  assignedTo: z.string().trim().min(1),
  dueDate: z.string().datetime().optional(), // ISO string
  notes: z.string().optional().nullable(),
  items: z.array(CreateOrderItemSchema).min(1),
});

export const UpdateOrderStatusSchema = z.object({
  status: OrderStatusSchema,
});

export const UpdateOrderPersonnelSchema = z.object({
  receivedBy: z.string().trim().min(1),
  assignedTo: z.string().trim().min(1),
});
