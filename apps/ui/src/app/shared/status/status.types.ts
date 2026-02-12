export const ORDER_STATUSES = [
  'New',
  'In Progress',
  'Fitting',
  'Ready',
  'Delivered',
  'Cancelled'
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
