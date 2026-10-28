"use client";

import { AdminSessionProvider } from "@/components/admin/AdminSession";
import { AdminShell } from "@/components/admin/AdminShell";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminShell>{children}</AdminShell>
    </AdminSessionProvider>
  );
}
