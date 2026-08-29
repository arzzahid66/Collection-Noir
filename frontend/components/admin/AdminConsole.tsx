"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, adminApi } from "@/lib/admin";
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
  { id: "categories", label: "Categories" },
  { id: "materials", label: "Materials" },
  { id: "pages", label: "Pages" },
  { id: "enquiries", label: "Enquiries" },
];

export function AdminConsole() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("pieces");

  useEffect(() => {
    adminApi
      .session()
      .then((session) => setEmail(session.email))
      .catch(() => setEmail(null))
      .finally(() => setChecking(false));
  }, []);

  // A 401 anywhere in the console means the session has gone. Rather than
  // failing silently, drop straight back to the sign in screen.
  const onUnauthorised = useCallback(() => setEmail(null), []);

  if (checking) {
    return (
      <div className="admin-login">
        <p className="admin-status">Checking your session.</p>
      </div>
    );
  }

  if (!email) {
    return <SignIn onSignedIn={setEmail} />;
  }

  return (
    <div className="admin">
      <div className="admin__bar">
        <span className="admin__title">Collection Noir</span>
        <span className="admin__who">
          {email}
          <button
            type="button"
            className="admin-button admin-button--quiet"
            style={{ marginLeft: 16 }}
            onClick={() => adminApi.logout().finally(() => setEmail(null))}
          >
            Sign out
          </button>
        </span>
      </div>

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
        {tab === "pieces" && <ProductsPanel onUnauthorised={onUnauthorised} />}
        {tab === "images" && <ImagesPanel onUnauthorised={onUnauthorised} />}
        {tab === "categories" && <CategoriesPanel onUnauthorised={onUnauthorised} />}
        {tab === "materials" && <MaterialsPanel onUnauthorised={onUnauthorised} />}
        {tab === "pages" && <PagesPanel onUnauthorised={onUnauthorised} />}
        {tab === "enquiries" && <EnquiriesPanel onUnauthorised={onUnauthorised} />}
      </div>
    </div>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: (email: string) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const session = await adminApi.login(
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
      );
      onSignedIn(session.email);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not reach the atelier service.",
      );
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
