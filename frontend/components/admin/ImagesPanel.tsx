"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { adminApi, ratioDelta, type ImageSlot, type SlotImage } from "@/lib/admin";
import { PanelProps, StatusLine, usePanelStatus } from "./common";

/**
 * Every image slot on the site, grouped by the page it appears on.
 *
 * Unlike the rest of the console, an upload is not held in the draft: it
 * reaches the public site as soon as the photograph has been processed.
 */
export function ImagesPanel({ onUnauthorised }: PanelProps) {
  const { status, tone, report, say } = usePanelStatus(onUnauthorised);
  const [slots, setSlots] = useState<ImageSlot[]>([]);

  const load = useCallback(async () => {
    try {
      setSlots(await adminApi.slots());
    } catch (error) {
      report(error);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = [...new Set(slots.map((slot) => slot.page ?? "Other"))];

  return (
    <>
      <p className="admin-note">
        <strong>Uploads go live straight away</strong>, without publishing. Photographs are
        resized for the web but never cropped: a photograph that does not match its frame
        is letterboxed onto the mount colour. Only the homepage hero fills its frame, and
        its focal point decides what stays in view.
      </p>
      <StatusLine status={status} tone={tone} />

      {pages.map((page) => (
        <section key={page} style={{ marginBottom: 32 }}>
          <h2 className="admin-heading">{page}</h2>
          <div className="image-grid image-grid--slots">
            {slots
              .filter((slot) => (slot.page ?? "Other") === page)
              .map((slot) => (
                <div className="image-tile" key={slot.key}>
                  <p className="image-tile__meta">
                    <strong>{slot.name ?? slot.key}</strong> · {slot.ratio}
                  </p>
                  <SlotEditor
                    slotKey={slot.key}
                    ratio={slot.ratio}
                    initial={slot}
                    onMessage={say}
                    onError={report}
                  />
                </div>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}

/**
 * One slot: its photographs, replace, add to gallery, revert, and for the
 * hero a focal point. Used here and on a piece's page in the console.
 */
export function SlotEditor({
  slotKey,
  ratio,
  initial,
  onMessage,
  onError,
}: {
  slotKey: string;
  ratio: string;
  initial?: ImageSlot;
  onMessage: (message: string) => void;
  onError: (error: unknown) => void;
}) {
  const [slot, setSlot] = useState<ImageSlot | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await adminApi.slot(slotKey);
      setSlot(next);
      // Sizes are generated after the upload returns. Check back until done.
      const pending = [next.image, ...next.gallery].some((i) => i?.status === "processing");
      if (pending) poll.current = setTimeout(() => void refresh(), 2500);
    } catch (error) {
      onError(error);
    }
  }, [slotKey, onError]);

  useEffect(() => {
    if (!initial) void refresh();
    return () => {
      if (poll.current) clearTimeout(poll.current);
    };
  }, [initial, refresh]);

  async function upload(files: FileList | null, append: boolean) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      let first = !append;
      for (const file of Array.from(files)) {
        // The first file replaces when asked to; any further ones are added.
        await adminApi.upload(slotKey, file, !first);
        first = false;
      }
      onMessage("Uploaded. It is live once processing finishes.");
      await refresh();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  async function revert() {
    if (!window.confirm("Remove the uploaded photographs from this slot? This is live at once.")) {
      return;
    }
    setBusy(true);
    try {
      await adminApi.clearSlot(slotKey);
      onMessage("Slot cleared.");
      await refresh();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  async function focus(event: React.MouseEvent<HTMLDivElement>) {
    if (slotKey !== "hero" || !slot?.image) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - box.left) / box.width) * 100) / 100;
    const y = Math.round(((event.clientY - box.top) / box.height) * 100) / 100;
    try {
      setSlot(await adminApi.focalPoint(slotKey, x, y));
      onMessage(`Focal point set to ${Math.round(x * 100)}% across, ${Math.round(y * 100)}% down.`);
    } catch (error) {
      onError(error);
    }
  }

  if (!slot) return <p className="admin-status">Loading photographs.</p>;

  const photos = [slot.image, ...slot.gallery].filter(
    (photo, index, all): photo is SlotImage =>
      photo !== null && all.findIndex((p) => p?.id === photo.id) === index,
  );
  const frame = ratio.replace("/", " / ");

  return (
    <div className="slot">
      {photos.length === 0 ? (
        <div className="slot__photos">
          <div className="image-tile__preview" style={{ aspectRatio: frame }}>
            <span className="image-tile__meta">No photograph</span>
          </div>
        </div>
      ) : (
        <div className="slot__photos">
          {photos.map((photo, index) => {
            const check = ratioDelta(photo, ratio);
            const hero = slotKey === "hero" && index === 0;
            return (
              <figure key={photo.id} className="slot__photo">
                <div
                  className="image-tile__preview"
                  onClick={hero ? focus : undefined}
                  title={hero ? "Click to set the focal point" : undefined}
                  style={{
                    aspectRatio: frame,
                    backgroundImage: `url(${photo.fallback})`,
                    backgroundColor: slot.fill,
                    backgroundSize: slot.fit === "cover" ? "cover" : "contain",
                    backgroundPosition: `${photo.focal_point.x * 100}% ${photo.focal_point.y * 100}%`,
                    cursor: hero ? "crosshair" : undefined,
                  }}
                />
                <figcaption className="image-tile__meta">
                  {index === 0 ? "Main" : `Gallery ${index}`} · {photo.width} × {photo.height}
                  {photo.status !== "ready" && ` · ${photo.status}`}
                </figcaption>
                {slot.fit !== "cover" && (
                  <span className="ratio-badge" data-ok={check.withinTolerance}>
                    {check.label}
                  </span>
                )}
              </figure>
            );
          })}
        </div>
      )}

      <div className="admin-actions" style={{ marginTop: 10 }}>
        <label className="admin-button admin-button--quiet" aria-disabled={busy}>
          {photos.length ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            disabled={busy}
            onChange={(event) => {
              void upload(event.target.files, false);
              event.target.value = "";
            }}
          />
        </label>
        {photos.length > 0 && (
          <label className="admin-button admin-button--quiet" aria-disabled={busy}>
            Add to gallery
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              disabled={busy}
              onChange={(event) => {
                void upload(event.target.files, true);
                event.target.value = "";
              }}
            />
          </label>
        )}
        {slot.status === "custom" && (
          <button
            type="button"
            className="admin-button admin-button--quiet"
            disabled={busy}
            onClick={revert}
          >
            Clear
          </button>
        )}
        {busy && <span className="admin-status">Uploading</span>}
      </div>
    </div>
  );
}
