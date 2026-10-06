"use client";
import styles from "./workspace-header.module.css";
import { nav, type Module } from "@/components/stockwell/navigation";
import { useWorkspace } from "@/lib/stockwell/use-workspace";
import type { Workspace } from "@/lib/stockwell/workspace";
import { Bell, ChevronDown, LogOut, RefreshCw, Settings } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
type Props = {
  go: (m: Module) => void;
  canAccess: (name: string) => boolean;
  module: Module;
  profileMenu: RefObject<HTMLDetailsElement | null>;
  account: Workspace;
  workspace: ReturnType<typeof useWorkspace>;
  notificationReturn: RefObject<Module>;
  setProductSearch: Dispatch<SetStateAction<string>>;
  setModule: Dispatch<SetStateAction<Module>>;
  setNotice: Dispatch<SetStateAction<string>>;
};
export function WorkspaceHeader({
  go,
  canAccess,
  module,
  profileMenu,
  account,
  workspace,
  notificationReturn,
  setProductSearch,
  setModule,
  setNotice,
}: Props) {
  return (
    <header className="topbar">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          go("Dashboard");
        }}
      >
        <span className="brand-mark">
          <span>S</span>
        </span>
        STOCKWELL<span className="brand-dot">.</span>
      </a>
      <span className="retail-pill">RETAIL</span>
      <nav className="top-navigation" aria-label="Main navigation">
        {nav
          .filter(({ name }) => canAccess(name))
          .map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={module === name ? "active" : ""}
              onClick={() => go(name)}
              aria-label={name}
              aria-current={module === name ? "page" : undefined}
              title={name}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className="nav-label">{name}</span>
            </button>
          ))}
      </nav>
      <details
        className={styles.profileMenu}
        ref={profileMenu}
        onKeyDown={(e) => {
          if (e.key === "Escape" && profileMenu.current)
            profileMenu.current.open = false;
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            e.currentTarget.open = false;
        }}
      >
        <summary className="top-profile" aria-label="Profile and navigation">
          <span>{account.name}</span>
          <span className="profile-orb">
            {account.image ? (
              <img src={account.image} alt={account.name} />
            ) : (
              account.name.slice(0, 1)
            )}
          </span>
          <ChevronDown size={16} />
        </summary>
        <div className={styles.dropdown}>
          <p>
            {account.member.name} · {account.member.role}
          </p>
          <nav className={styles.mobileNavigation} aria-label="Mobile navigation">
            {nav
              .filter(({ name }) => canAccess(name))
              .map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  aria-current={module === name ? "page" : undefined}
                  onClick={() => go(name)}
                >
                  <Icon size={18} />
                  {name}
                </button>
              ))}
          </nav>
          <button onClick={() => void workspace.sync()}>
            <RefreshCw size={16} /> {workspace.syncStatus}
            {workspace.cache?.queue.length
              ? ` (${workspace.cache.queue.length})`
              : ""}
          </button>
          {account.member.role === "owner" && (
            <>
              <button
                onClick={() => {
                  notificationReturn.current = module;
                  setProductSearch("");
                  setModule("Notifications");
                  if (profileMenu.current) profileMenu.current.open = false;
                }}
              >
                <Bell size={16} /> Notifications & logs{" "}
                {account.audit.length &&
                account.audit[0].id !== account.readEvent ? (
                  <span className="badge paid">New</span>
                ) : null}
              </button>
              <button
                onClick={() => {
                  setProductSearch("");
                  setModule("Settings");
                  if (profileMenu.current) profileMenu.current.open = false;
                }}
              >
                <Settings size={16} /> Settings
              </button>
            </>
          )}
          <button
            onClick={() =>
              void workspace.signout().catch((e) => setNotice(e.message))
            }
          >
            <LogOut size={16} /> Sign out
          </button>
          {!!workspace.cache?.queue.length && (
            <>
              <button onClick={workspace.exportPending}>
                Export pending changes
              </button>
              {workspace.syncStatus.startsWith("Conflict") && (
                <button
                  onClick={() =>
                    void workspace
                      .useServer()
                      .catch((e) => setNotice(e.message))
                  }
                >
                  Load server records
                </button>
              )}
            </>
          )}
        </div>
      </details>
    </header>
  );
}
