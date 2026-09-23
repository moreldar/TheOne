export type NotificationTemplate =
  | "order_confirmed"
  | "order_in_production"
  | "order_shipped";

export interface NotificationInput {
  template: NotificationTemplate;
  to: string;
  data: Record<string, unknown>;
}

/**
 * Provider-agnostic transactional email/notification sending.
 */
export interface NotificationProvider {
  readonly name: string;
  send(input: NotificationInput): Promise<void>;
}
