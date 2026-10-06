"use client";
import { type Module } from "@/components/stockwell/navigation";
import { Table } from "@/components/stockwell/ui";
import { useWorkspace } from "@/lib/stockwell/use-workspace";
import type { Workspace } from "@/lib/stockwell/workspace";
import { X } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
type Props = {
  workspace: ReturnType<typeof useWorkspace>;
  account: Workspace;
  setNotice: Dispatch<SetStateAction<string>>;
  setModule: Dispatch<SetStateAction<Module>>;
  notificationReturn: RefObject<Module>;
};
export function NotificationsView({
  workspace,
  account,
  setNotice,
  setModule,
  notificationReturn,
}: Props) {
  return (
    <section className="settings-page">
      <div className="page-heading">
        <div>
          <h1>Notifications & activity logs</h1>
          <p>Who changed what, with action and sync times.</p>
          <button
            onClick={() =>
              void workspace
                .action({
                  action: "read",
                  event: account.audit[0]?.id,
                })
                .catch((e) => setNotice(e.message))
            }
          >
            Mark notifications read
          </button>
        </div>
        <button
          className="icon-button"
          aria-label="Close notifications"
          onClick={() => setModule(notificationReturn.current)}
        >
          <X size={22} />
        </button>
      </div>
      <Table
        headers={["Who", "Module", "Action / records", "When", "Email"]}
        rows={account.audit.map((a) => [
          a.actor,
          a.module,
          <div key={a.id}>
            {a.action}
            <small>{a.records}</small>
          </div>,
          <div key={a.id}>
            {new Date(a.occurredAt).toLocaleString()}
            <small>Synced {new Date(a.receivedAt).toLocaleString()}</small>
          </div>,
          a.emailStatus,
        ])}
      />
    </section>
  );
}
