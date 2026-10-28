/**
 * Session-expiry signalling. The API client reports 401/403 from authenticated endpoints here;
 * the admin shell and the customer account listen and react (redirect to sign-in, refresh
 * permissions, clear the "signed in" hint). Nothing here reads cookies: sessions are httpOnly.
 */
export type AuthScope = "customer" | "admin";
export interface AuthEvent {
  status: 401 | 403;
  scope: AuthScope;
  endpoint: string;
}

type Listener = (e: AuthEvent) => void;
const listeners = new Set<Listener>();

export function onAuthEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAuthEvent(e: AuthEvent) {
  listeners.forEach((l) => l(e));
}
