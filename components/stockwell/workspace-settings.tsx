"use client";
import { chartAccounts } from "@/lib/stockwell/accounts";
import { saveFinancialAccount } from "@/lib/stockwell/bank-vouchers";
import { Check, Copy, Link2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { modules, type Workspace } from "@/lib/stockwell/workspace";
import type { Cache } from "@/lib/stockwell/workspace";
import { uid, type Store } from "@/lib/stockwell/model";
import { WorkspaceBackup } from "@/components/stockwell/workspace-backup";

export function WorkspaceSettings({
  workspace,
  action,
  cache,
  store,
  commitStore,
}: {
  workspace: Workspace;
  action: (body: unknown) => Promise<any>;
  cache: Cache;
  store: Store;
  commitStore: (store: Store) => void;
}) {
  const [name, setName] = useState(workspace.name),
    [image, setImage] = useState(workspace.image),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [invite, setInvite] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  const inviteInput = useRef<HTMLInputElement>(null);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<"Bank" | "Wallet">("Bank");
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
    } catch {
      setCopied(false);
      inviteInput.current?.focus();
      inviteInput.current?.select();
      setNotice("Link selected. Copy it to share with your team member.");
    }
  }
  async function run(body: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action(body);
      setNotice("Workspace updated.");
      if (result.invite) {
        setCopied(false);
        setInvite(`${location.origin}/team-sign-up?invite=${encodeURIComponent(result.invite)}`);
        setNotice("Team member added. Share the setup link so they can create their password.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }
  function permissions(f: HTMLFormElement) {
    return new FormData(f).getAll("modules");
  }
  return (
    <section className="settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE OWNER</span>
          <h1>Settings</h1>
          <p>Your store identity and your team’s authority.</p>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="settings-grid">
        <section className="panel">
          <h2>Store profile</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run({ action: "settings", name, image });
            }}
          >
            <label className="field">
              <span>Store name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label className="field">
              <span>Store image (optional · up to 500 KB)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 500000) {
                    setError("Choose an image under 500 KB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => setImage(String(reader.result));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {image && (
              <div className="store-image-preview">
                <img src={image} alt="Store image preview" />
                <button type="button" onClick={() => setImage("")}>
                  Remove image
                </button>
              </div>
            )}
            <button className="primary" disabled={busy}>
              Save store profile
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Add a team member</h2>
          <p>
            Assign their email and select the modules they can use. They will sign up with that email and choose their own password.
          </p>
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              void run({
                action: "add-member",
                email: new FormData(e.currentTarget).get("email"),
                modules: permissions(e.currentTarget),
              });
            }}
          >
            <label className="field">
              <span>Member email</span>
              <input type="email" name="email" required />
            </label>
            <div className="permission-grid">
              {modules.map((m) => (
                <label key={m}>
                  <input type="checkbox" name="modules" value={m} />
                  {m}
                </label>
              ))}
            </div>
            <button disabled={busy} className="primary">
              Add team member
            </button>
          </form>
          {invite && (
            <section className="team-signup-link" aria-label="Team member signup link">
              <div className="team-signup-link-heading">
                <span className="team-link-icon"><Link2 size={18} /></span>
                <div><h3>Member signup link</h3><p>Share with the assigned member · expires in 7 days</p></div>
              </div>
              <div className="team-signup-link-controls">
                <input ref={inviteInput} aria-label="Member signup link" readOnly value={invite} onFocus={(e) => e.target.select()} />
                <button type="button" className="secondary-button" onClick={() => void copyInvite()}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <small role="status">{copied ? "Link copied. Ready to share." : "The member uses their assigned email and creates their own password."}</small>
            </section>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Team authority</h2>
        {workspace.members.map((m) => (
          <form
            className="member-authority"
            key={m.id}
            onSubmit={(e) => {
              e.preventDefault();
              void run({
                action: "permissions",
                user: m.id,
                modules: permissions(e.currentTarget),
              });
            }}
          >
            <h3>
              {m.name}{" "}
              <small>
                {m.email} · {m.role}
              </small>
            </h3>
            {m.role === "owner" ? (
              <p>Full workspace authority.</p>
            ) : (
              <>
                <div className="permission-grid">
                  {modules.map((module) => (
                    <label key={module}>
                      <input
                        type="checkbox"
                        name="modules"
                        value={module}
                        defaultChecked={m.modules.includes(module)}
                      />
                      {module}
                    </label>
                  ))}
                </div>
                <button disabled={busy}>Save permissions</button>
              </>
            )}
          </form>
        ))}
      </section>
      <WorkspaceBackup action={action} cache={cache} settings />
      <section className="panel">
        <h2>Bank and wallet accounts</h2>
        <p>Add each account your business uses. These appear as payment methods when recording bills, payments, and expenses.</p>
        <form className="form-grid" onSubmit={(e) => {
          e.preventDefault();
          const name = accountName.trim();
          if (!name) return;
          const accounts = store.financialAccounts || [];
          if (accounts.some((account) => account.name.toLowerCase() === name.toLowerCase())) {
            setError("That payment account already exists.");
            return;
          }
          try { commitStore(saveFinancialAccount(store, { id: uid(), name, type: accountType, active: true })); }
          catch (err) { setError(err instanceof Error ? err.message : "Could not add account."); return; }
          setAccountName("");
          setNotice("Payment account added.");
        }}>
          <label className="field"><span>Account name</span><input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g. HBL Business Account" maxLength={120} required /></label>
          <label className="field"><span>Account type</span><select value={accountType} onChange={(e) => setAccountType(e.target.value as "Bank" | "Wallet")}><option>Bank</option><option>Wallet</option></select></label>
          <button className="primary" disabled={busy}>Add account</button>
        </form>
        <div className="permission-grid">{(store.financialAccounts || []).map((account) => <div key={account.id}>
          <b>{account.name} · {account.type}</b>
          <label className="field"><span>Asset ledger account / opening balance</span><select value={account.ledgerAccountId || ""} onChange={e => {
            try { commitStore(saveFinancialAccount(store, { ...account, ledgerAccountId: e.target.value })); setError(""); }
            catch (err) { setError(err instanceof Error ? err.message : "Could not update account."); }
          }}><option value="">Select ledger account</option>{chartAccounts(store).filter(a => a.type === "Asset" && !chartAccounts(store).some(child => child.parentId === a.id)).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
          <button type="button" className="link" onClick={() => {
            try { commitStore(saveFinancialAccount(store, { ...account, active: account.active === false })); setError(""); }
            catch (err) { setError(err instanceof Error ? err.message : "Could not update account."); }
          }}>{account.active === false ? "Reactivate" : "Deactivate"}</button>
        </div>)}</div>
      </section>
      <section className="panel">
        <h2>Previous browser records</h2>
        <p>
          Import records from the earlier StockHale version into a new empty
          workspace. The original browser copy is retained.
        </p>
        <button
          disabled={busy || workspace.revision !== 0}
          onClick={() => {
            const raw = localStorage.getItem("stockwell.retail.v1");
            if (!raw) {
              setError("No previous records found in this browser.");
              return;
            }
            try {
              void run({ action: "import", store: JSON.parse(raw) });
            } catch {
              setError("Previous records could not be read.");
            }
          }}
        >
          Import previous records
        </button>
      </section>
      <section className="panel">
        <h2>Email notifications</h2>
        <p>
          {workspace.emailConfigured
            ? "Resend is configured. Record changes notify the workspace owner."
            : "Resend is not configured yet. Set RESEND_API_KEY and RESEND_FROM on the server. Alerts are kept in the email outbox."}
        </p>
        <button
          disabled={busy}
          onClick={() => void run({ action: "retry-email" })}
        >
          Retry due email notifications
        </button>
      </section>
    </section>
  );
}
