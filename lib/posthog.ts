/**
 * Server-side PostHog client for API routes and webhooks
 */
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  // Only initialize if API key is present
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    });
  }

  return posthogClient;
}

/**
 * Track an event, silently failing if PostHog is not configured
 */
export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, any>
) {
  const client = getPostHogClient();
  if (!client) return;

  try {
    client.capture({
      distinctId,
      event,
      properties,
    });
  } catch (error) {
    console.error("[PostHog] Failed to track event:", error);
  }
}

/**
 * Shutdown PostHog client gracefully
 */
export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}

