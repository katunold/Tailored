export const ItemCategory = {
  ALB_SURPLICE: "ALB_SURPLICE",
  CHASUBLE_DALMATIC: "CHASUBLE_DALMATIC",
  CLERICAL: "CLERICAL",
  OTHER: "OTHER",
} as const;

export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

export const OrderStatus = {
  PLACED: "PLACED",
  PROCESSING: "PROCESSING",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
