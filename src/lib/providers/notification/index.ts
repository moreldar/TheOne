import { config } from "@/lib/config";
import { ConsoleNotificationProvider } from "./consoleProvider";
import type { NotificationProvider } from "./types";

export * from "./types";

let cached: NotificationProvider | undefined;

export function getNotificationProvider(): NotificationProvider {
  if (cached) return cached;

  switch (config.providers.notification) {
    case "console":
      cached = new ConsoleNotificationProvider();
      break;
    // TODO(real-integration): case "resend": cached = new ResendNotificationProvider(); break;
    // TODO(real-integration): case "postmark": cached = new PostmarkNotificationProvider(); break;
    default:
      console.warn(
        `[notification] Unknown NOTIFICATION_PROVIDER "${config.providers.notification}", falling back to console.`,
      );
      cached = new ConsoleNotificationProvider();
  }

  return cached;
}
