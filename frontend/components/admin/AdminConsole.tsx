"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, adminApi, type AdminUser, type DraftDiff } from "@/lib/admin";
import { CategoriesPanel } from "./CategoriesPanel";
import { EnquiriesPanel } from "./EnquiriesPanel";
import { ImagesPanel } from "./ImagesPanel";
import { MaterialsPanel } from "./MaterialsPanel";
import { PagesPanel } from "./PagesPanel";
import { ProductsPanel } from "./ProductsPanel";

type Tab = "pieces" | "images" | "categories" | "materials" | "pages" | "enquiries";

const TABS: { id: Tab; label: string }[] = [
  { id: "pieces", label: "Pieces" },
  { id: "images", label: "Images" },
  { id: "categories", label: "Collections" },
  { id: "materials", label: "Materials" },
  { id: "enquiries", label: "Inbox" },
  { id: "pages", label: "Pages" },
];

export function AdminConsole() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("pieces");
  const [diff, setDiff] = useState<DraftDiff | null>(null);

  // A reload keeps no token in memory, so resume from the refresh cookie.
  useEffect(() => {
    adminApi
      .restore()
      .then(setUser)
      .finally(() => setChecking(false));
  }, []);

  const onUnauthorised = useCallback(() => setUser(null), []);

  const recount = useCallback(async () => {
    try {
      setDiff(await adminApi.diff());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null);
    }
  }, []);

  useEffect(() => {
    if (user) void recount();
  }, [user, recount]);

  if (checking) {
    return (
      <div className="admin-login">
        <p className="admin-status">Checking your session.</p>
      </div>
    );
  }

  if (!user) {
    return <SignIn onSignedIn={setUser} />;
  }

  if (user.mustChangePassword) {
    return (
      <div className="admin-login">
        <div className="admin-login__panel">
          <h1>Administration</h1>
          <p className="admin-status" data-tone="error">
            This account must change its password before it can edit. Ask the site owner
            to reset it.
          </p>
        </div>
      </div>
    );
  }

  const panelProps = { onUnauthorised, onDraftChanged: recount };

  return (
    <div className="admin">
      <div className="admin__bar">
        <span className="admin__title">Collection Noir</span>
        <span className="admin__who">
          {user.email} · {user.role}
          <button
            type="button"
            className="admin-button admin-button--quiet"
            style={{ marginLeft: 16 }}
            onClick={() => adminApi.logout().finally(() => setUser(null))}
          >
            Sign out
          </button>
        </span>
      </div>

      <PublishBar diff={diff} onChanged={recount} onUnauthorised={onUnauthorised} />

      <nav className="admin__tabs" aria-label="Administration sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="admin__tab"
            data-active={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="admin__body">
        {tab === "pieces" && <ProductsPanel {...panelProps} />}
        {tab === "images" && <ImagesPanel {...panelProps} />}
        {tab === "categories" && <CategoriesPanel {...panelProps} />}
        {tab === "materials" && <MaterialsPanel {...panelProps} />}
        {tab === "pages" && <PagesPanel />}
        {tab === "enquiries" && <EnquiriesPanel {...panelProps} />}
      </div>
    </div>
  );
}

/**
 * The draft, summarised, with the two actions that act on it.
 *
 * Every catalogue edit lands in the draft, and the public site changes only
 * when it is published. So what is waiting, and the button that releases it,
 * stay in view whichever section is open.
 */
function PublishBar({
  diff,
  onChanged,
  onUnauthorised,
}: {
  diff: DraftDiff | null;
  onChanged: () => Promise<void>;
  onUnauthorised: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "error">("info");

  if (!diff) return null;

  const { changes } = diff;
  const summary = (
    [
      ["collection", changes.categories],
      ["piece", changes.products],
      ["material", changes.materials],
    ] as const
  )
    .flatMap(([noun, set]) =>
      (
        [
          ["added", set.created.length],
          ["edited", set.updated.length],
          ["removed", set.deleted.length],
        ] as const
      )
        .filter(([, count]) => count > 0)
        .map(([verb, count]) => `${count} ${noun}${count === 1 ? "" : "s"} ${verb}`),
    )
    .concat(changes.materialsNoteChanged ? ["materials note edited"] : []);

  async function act(kind: "publish" | "discard") {
    const question =
      kind === "publish"
        ? "Publish the draft? The public site will change straight away."
        : "Discard every unpublished edit? This cannot be undone.";
    if (!window.confirm(question)) return;
    setBusy(true);
    setMessage("");
    try {
      if (kind === "publish") {
        await adminApi.publish();
        setMessage("Published. The site now shows these changes.");
      } else {
        await adminApi.discard();
        setMessage("Draft discarded. The console now matches the live site.");
      }
      setTone("info");
      await onChanged();
      if (kind === "discard") window.location.reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return onUnauthorised();
      setTone("error");
      setMessage(error instanceof ApiError ? error.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-publish" data-pending={diff.hasChanges}>
      <div>
        <strong>{diff.hasChanges ? "Unpublished changes" : "The site is up to date"}</strong>
        {diff.hasChanges && summary.length > 0 && <span> · {summary.join(", ")}</span>}
        {changes.violations.map((v) => (
          <p key={`${v.code}-${v.slug}`} className="admin-status" data-tone="error">
            {v.message}
          </p>
        ))}
        {changes.warnings.map((w) => (
          <p key={w} className="admin-status">
            {w}
          </p>
        ))}
        {message && (
          <p className="admin-status" data-tone={tone} role="status">
            {message}
          </p>
        )}
      </div>
      {diff.hasChanges && (
        <div className="admin-actions">
          <button
            type="button"
            className="admin-button admin-button--quiet"
            disabled={busy}
            onClick={() => act("discard")}
          >
            Discard
          </button>
          <button
            type="button"
            className="admin-button"
            disabled={busy || changes.violations.length > 0}
            onClick={() => act("publish")}
          >
            {busy ? "Working" : "Publish"}
          </button>
        </div>
      )}
    </div>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: (user: AdminUser) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      onSignedIn(
        await adminApi.login(String(form.get("email") ?? ""), String(form.get("password") ?? "")),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the atelier service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__panel">
        <h1>Administration</h1>
        <p className="admin__who" style={{ marginBottom: 28, display: "block" }}>
          Collection Noir
        </p>
        <form className="admin-form" onSubmit={onSubmit}>
          <div className="admin-field">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              required
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="admin-status" data-tone="error" role="alert">
              {error}
            </p>
          )}
          <button className="admin-button" type="submit" disabled={busy}>
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
