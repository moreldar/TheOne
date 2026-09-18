import { OrderStatus } from "@prisma/client";

/**
 * Order lifecycle:
 *
 *   PENDING -> PAID -> IN_PRODUCTION -> SHIPPED -> DELIVERED
 *                    \-> CANCELLED
 *           -> CANCELLED
 *      PAID -> REFUNDED
 *      IN_PRODUCTION -> REFUNDED
 *      SHIPPED -> REFUNDED
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.IN_PRODUCTION, OrderStatus.REFUNDED],
  [OrderStatus.IN_PRODUCTION]: [OrderStatus.SHIPPED, OrderStatus.REFUNDED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Invalid Order status transition: ${from} -> ${to}`);
  }
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
