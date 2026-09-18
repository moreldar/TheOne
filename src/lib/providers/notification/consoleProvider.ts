import type { NotificationInput, NotificationProvider } from "./types";

/**
 * Logs instead of sending. Good enough to verify the right notifications
 * fire at the right lifecycle points during development.
 *
 * TODO(real-integration): replace with Resend (RESEND_API_KEY,
 * RESEND_FROM_EMAIL) or Postmark (POSTMARK_SERVER_TOKEN). Each
 * `NotificationTemplate` should map to a real email template — order
 * confirmed / in production / shipped — rendered with `data` (order id,
 * tracking link, etc).
 */
export class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = "console";

  async send(input: NotificationInput): Promise<void> {
    console.log(`[notification] (would send) "${input.template}" to ${input.to}`, input.data);
  }
}
