export const ORDER_STATUSES = [
  'Placed',
  'Processing',
  'Paused',
  'Completed',
  'Canceled'
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
