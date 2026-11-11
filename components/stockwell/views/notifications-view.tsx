"use client";
import { descriptions, type Module } from "@/components/stockwell/navigation";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { ServerPagination, Table } from "@/components/stockwell/ui";
import { useWorkspace } from "@/lib/stockwell/use-workspace";
import type { Workspace } from "@/lib/stockwell/workspace";
import { getFirstRecordTarget } from "@/lib/stockwell/audit-target";
import { X } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useState } from "react";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
type Props = {
  workspace: ReturnType<typeof useWorkspace>;
  account: Workspace;
  setNotice: Dispatch<SetStateAction<string>>;
  setModule: Dispatch<SetStateAction<Module>>;
  notificationReturn: RefObject<Module>;
  openRecord: (event: Workspace["audit"][number]) => void;
};
export function NotificationsView({
  workspace,
  account,
  setNotice,
  setModule,
  notificationReturn,
  openRecord,
}: Props) {
  const [actorFilter, setActorFilter] = useState("All users");
  const [moduleFilter, setModuleFilter] = useState("All modules");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const activity = useServerCollection<Workspace["audit"][number]>({ collection: "activityLog", actor: actorFilter === "All users" ? "" : actorFilter, moduleFilter: moduleFilter === "All modules" ? "" : moduleFilter, from, to, pageSize: 25 });
  const actors = (activity.meta?.actors as string[] | undefined) || [];
  const modules = (activity.meta?.modules as string[] | undefined) || [];
  const entries = activity.records;
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
      <div className="filters">
        <GlassSelect aria-label="Filter activity by user" value={actorFilter} onValueChange={setActorFilter}><option>All users</option>{actors.map(actor => <option key={actor}>{actor}</option>)}</GlassSelect>
        <GlassSelect aria-label="Filter activity by module" value={moduleFilter} onValueChange={setModuleFilter}><option>All modules</option>{modules.map(module => <option key={module}>{module}</option>)}</GlassSelect>
        <label className="field"><span>From date</span><input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label>
        <label className="field"><span>To date</span><input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
      </div>
      <Table
        headers={["Who", "Module", "Action", "When", "Email"]}
        rows={entries.map((a) => [
          a.actor,
          a.module,
          <div><span>{a.action} {a.module in descriptions && <button className="link" onClick={() => setModule(a.module as Module)}>View module</button>}</span>{getFirstRecordTarget(a.records, a.module) && <button className="link" onClick={() => openRecord(a)}>Open {getFirstRecordTarget(a.records, a.module)!.label}</button>}<details><summary>View record changes</summary><pre className="audit-details">{a.records.length > 12000 ? `${a.records.slice(0, 12000)}… (details truncated)` : a.records}</pre></details></div>,
          <div key={a.id}>
            {new Date(a.occurredAt).toLocaleString()}
            <small>Synced {new Date(a.receivedAt).toLocaleString()}</small>
          </div>,
          a.emailStatus,
        ])}
      />
      {activity.error && <p className="form-error" role="alert">{activity.error}</p>}
      <ServerPagination page={activity.page} pageCount={activity.pageCount} count={activity.count} pageSize={activity.pageSize} setPage={activity.setPage} />
    </section>
  );
}
