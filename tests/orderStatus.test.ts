import { describe, expect, it } from "vitest";
import { OrderStatus } from "@prisma/client";
import {
  assertOrderTransition,
  canTransitionOrder,
  isTerminalOrderStatus,
} from "@/lib/stateMachines/orderStatus";

describe("order status state machine", () => {
  it("allows the happy path PENDING -> PAID -> IN_PRODUCTION -> SHIPPED -> DELIVERED", () => {
    expect(canTransitionOrder(OrderStatus.PENDING, OrderStatus.PAID)).toBe(true);
    expect(canTransitionOrder(OrderStatus.PAID, OrderStatus.IN_PRODUCTION)).toBe(true);
    expect(canTransitionOrder(OrderStatus.IN_PRODUCTION, OrderStatus.SHIPPED)).toBe(true);
    expect(canTransitionOrder(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it("allows refunds from PAID, IN_PRODUCTION, SHIPPED, and DELIVERED", () => {
    expect(canTransitionOrder(OrderStatus.PAID, OrderStatus.REFUNDED)).toBe(true);
    expect(canTransitionOrder(OrderStatus.IN_PRODUCTION, OrderStatus.REFUNDED)).toBe(true);
    expect(canTransitionOrder(OrderStatus.SHIPPED, OrderStatus.REFUNDED)).toBe(true);
    expect(canTransitionOrder(OrderStatus.DELIVERED, OrderStatus.REFUNDED)).toBe(true);
  });

  it("allows cancellation only before payment", () => {
    expect(canTransitionOrder(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransitionOrder(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(false);
  });

  it("rejects skipping straight from PENDING to SHIPPED", () => {
    expect(canTransitionOrder(OrderStatus.PENDING, OrderStatus.SHIPPED)).toBe(false);
  });

  it("rejects any transition out of terminal states", () => {
    expect(isTerminalOrderStatus(OrderStatus.REFUNDED)).toBe(true);
    expect(isTerminalOrderStatus(OrderStatus.CANCELLED)).toBe(true);
    expect(canTransitionOrder(OrderStatus.REFUNDED, OrderStatus.PAID)).toBe(false);
  });

  it("rejects a no-op transition", () => {
    expect(canTransitionOrder(OrderStatus.PAID, OrderStatus.PAID)).toBe(false);
  });

  it("throws on an invalid transition", () => {
    expect(() => assertOrderTransition(OrderStatus.PENDING, OrderStatus.SHIPPED)).toThrow(
      /Invalid Order status transition/,
    );
  });

  it("does not throw on a valid transition", () => {
    expect(() => assertOrderTransition(OrderStatus.PENDING, OrderStatus.PAID)).not.toThrow();
  });
});
