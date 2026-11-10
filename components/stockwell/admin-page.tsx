"use client";

import { AdminPanel } from "@/components/stockwell/admin-panel";

export function AdminPage() {
  return (
    <div className="admin-expired-shell">
      <AdminPanel onBack={() => window.location.assign("/workspace")} />
    </div>
  );
}
