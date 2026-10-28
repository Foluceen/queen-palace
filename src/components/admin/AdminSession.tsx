"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { api } from "@/lib/api/browser";
import { onAuthEvent } from "@/lib/api/auth-events";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { AdminSession, Permission } from "@/lib/types";

interface SessionValue {
  session: AdminSession;
  /** UI-only check to hide or disable controls. The backend enforces every permission. */
  can(permission: Permission): boolean;
  signOut(): Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSession(await api().call("adminSession"));
    } catch (err) {
      // 401: not signed in. 403 on the session endpoint: account suspended or removed.
      if (err instanceof ApiError && (err.isUnauthorized || err.isForbidden)) {
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      } else setError(errorMessage(err));
    }
  }, [router, pathname]);

  useEffect(() => {
    void load();
    const toLogin = () => {
      setSession(null);
      const here = `${window.location.pathname}${window.location.search}`;
      router.replace(`/admin/login?expired=1&next=${encodeURIComponent(here)}`);
    };
    // Re-check the session when the tab regains focus (expired or revoked sessions).
    const onFocus = () =>
      void api()
        .call("adminSession")
        .then(setSession)
        .catch((err) => {
          if (err instanceof ApiError && (err.isUnauthorized || err.isForbidden)) toLogin();
        });
    // Any admin request that comes back 401 means the session expired: go to sign-in.
    // A 403 means permissions changed: reload the session so the UI matches the backend.
    const off = onAuthEvent((e) => {
      if (e.scope !== "admin" || e.endpoint === "adminSession") return;
      if (e.status === 401) toLogin();
      else void api().call("adminSession").then(setSession).catch(() => {});
    });
    window.addEventListener("focus", onFocus);
    return () => {
      off();
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="admin-boot" role="alert">
        <Logo variant="stacked" title="Queen Palace Beauty World" />
        <h1 className="h3">The admin can't reach the store API</h1>
        <p className="muted">{error}</p>
        <button type="button" className="btn" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="admin-boot" aria-busy="true">
        <span className="spinner" aria-label="Checking your session" />
      </div>
    );
  }

  const value: SessionValue = {
    session,
    can: (p) => session.permissions.includes(p),
    signOut: async () => {
      await api().call("adminLogout").catch(() => {});
      router.replace("/admin/login");
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin must be used inside AdminSessionProvider");
  return v;
}

/** Renders children only when the staff member holds the permission. */
export function Can({ permission, children, fallback = null }: { permission: Permission; children: ReactNode; fallback?: ReactNode }) {
  const { can } = useAdmin();
  return <>{can(permission) ? children : fallback}</>;
}

/** Full-page gate for sections a role can't open. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAdmin();
  if (!can(permission)) {
    return (
      <div className="admin-denied">
        <h1 className="h2">You don't have access to this section</h1>
        <p className="muted">Ask the store owner to add the “{permission}” permission to your role.</p>
      </div>
    );
  }
  return <>{children}</>;
}
