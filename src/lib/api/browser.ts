"use client";

import { emitAuthEvent } from "./auth-events";
import { browserApiBase } from "./config";
import { createApiClient, type ApiClient } from "./client";

let client: ApiClient | null = null;

/**
 * Singleton client for client components. Points at /api/mock in mock mode and at
 * NEXT_PUBLIC_API_BASE_URL in live mode. Auth failures are broadcast so the admin shell
 * and customer account can react to expired sessions.
 */
export function api(): ApiClient {
  if (!client) client = createApiClient(browserApiBase(), { timeoutMs: 20000, onAuthError: (e) => emitAuthEvent(e) });
  return client;
}
