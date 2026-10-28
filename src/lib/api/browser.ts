"use client";

import { browserApiBase } from "./config";
import { createApiClient, type ApiClient } from "./client";

let client: ApiClient | null = null;

/** Singleton client for client components. Points at /api/mock in mock mode. */
export function api(): ApiClient {
  if (!client) client = createApiClient(browserApiBase());
  return client;
}
