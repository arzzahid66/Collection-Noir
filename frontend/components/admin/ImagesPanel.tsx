"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi, ratioDelta } from "@/lib/admin";
import type { ImageRef } from "@/lib/types";
import { PanelProps, usePanelStatus } from "./common";

export function ImagesPanel({ onUnauthorised }: PanelProps) {
  const { status, tone, report, say } = usePanelStatus(onUnauthorised);
  const [images, setImages] = useState<ImageRef[]>([]);
  const [preview, setPreview] = useState<"3-2" | "4-5">("4-5");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setImages(await adminApi.images());
    } catch (error) {
      report(error);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await adminApi.uploadImage(file);
      }
      await load();
      say(`Uploaded ${files.length === 1 ? "one photograph" : `${files.length} photographs`}.`);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="admin-note">
        Photographs are stored exactly as uploaded. Nothing is cropped, resized
        or re-encoded at any point, which is why a supplied image can be trusted
        to appear as it was shot.
        <br />
        <br />
        Use the preview toggle to see how an image sits inside each category
        frame before attaching it to a piece. Within five per cent of the target
        the image sits close to edge to edge. Beyond that it letterboxes onto
        the mount colour, which is correct but worth seeing first.
      </p>

      <div className="admin-actions" style={{ marginBottom: 24 }}>
        <div className="admin-field" style={{ maxWidth: 320 }}>
          <label htmlFor="upload">Upload photography</label>
          <input
            id="upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(event) => upload(event.target.files)}
          />
          <span className="hint">JPEG for product photography, PNG for logo and interface assets.</span>
        </div>

        <div className="admin-field" style={{ maxWidth: 200 }}>
          <label htmlFor="preview-ratio">Preview against</label>
          <select
            id="preview-ratio"
            value={preview}
            onChange={(event) => setPreview(event.target.value as "3-2" | "4-5")}
          >
            <option value="3-2">3:2 · dining and coffee tables</option>
            <option value="4-5">4:5 · consoles, side, bedside, plinths</option>
          </select>
        </div>
      </div>

      {status && (
        <p className="admin-status" data-tone={tone} role="status">
          {status}
        </p>
      )}

      {images.length === 0 ? (
        <p className="admin-status">No photography uploaded yet.</p>
      ) : (
        <div className="image-grid">
          {images.map((image) => {
            const check = ratioDelta(image, preview);
            return (
              <div className="image-tile" key={image.id}>
                <div
                  className={`image-tile__preview ratio-${preview}`}
                  style={{ backgroundImage: `url(${image.url})` }}
                  role="img"
                  aria-label={image.alt_text ?? image.filename}
                />
                <span className="ratio-badge" data-ok={check.withinTolerance}>
                  {check.label}
                </span>
                <p className="image-tile__meta">{image.filename}</p>
                <p className="image-tile__meta">
                  {image.width} × {image.height} · {Math.round(image.byte_size / 1024)}kB
                </p>
                <div className="admin-field" style={{ marginTop: 8 }}>
                  <label htmlFor={`alt-${image.id}`}>Alternative text</label>
                  <input
                    id={`alt-${image.id}`}
                    defaultValue={image.alt_text ?? ""}
                    placeholder="Calacatta Viola. The Roma dining table."
                    onBlur={async (event) => {
                      if (event.target.value === (image.alt_text ?? "")) return;
                      try {
                        await adminApi.updateImage(image.id, event.target.value);
                        say("Alternative text saved.");
                      } catch (error) {
                        report(error);
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="admin-button admin-button--quiet"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    try {
                      await adminApi.deleteImage(image.id);
                      await load();
                      say("Photograph deleted.");
                    } catch (error) {
                      report(error);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
