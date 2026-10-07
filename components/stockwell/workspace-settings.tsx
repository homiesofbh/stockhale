"use client";
import { useState, type FormEvent } from "react";
import { modules, type Workspace } from "@/lib/stockwell/workspace";
export function WorkspaceSettings({
  workspace,
  action,
}: {
  workspace: Workspace;
  action: (body: unknown) => Promise<any>;
}) {
  const [name, setName] = useState(workspace.name),
    [image, setImage] = useState(workspace.image),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [invite, setInvite] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(body: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action(body);
      setNotice("Workspace updated.");
      if (result.invite) {
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
            <label className="field">
              <span>
                Share this signup link with the member (expires in 7 days)
              </span>
              <input
                readOnly
                value={invite}
                onFocus={(e) => e.target.select()}
              />
            </label>
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
      <section className="panel">
        <h2>Previous browser records</h2>
        <p>
          Import records from the earlier Stockwell version into a new empty
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
