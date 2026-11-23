import { useRef, useState } from "react";
import { api } from "../api.js";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf,video/mp4";

/** Drag & drop uploader ("Drop files to upload / Select Files"). */
export default function Uploader({ onUploaded, onError, compact }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(0);

  const upload = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setBusy(list.length);
    const uploaded = [];
    // Upload one by one so a bad file doesn't fail the whole batch
    for (const f of list) {
      const form = new FormData();
      form.append("file", f);
      try {
        const r = await api("/admin/media", { method: "POST", form });
        uploaded.push(...r.data);
      } catch (e) {
        onError?.(new Error(`“${f.name}” has failed to upload. ${e.message}`));
      }
      setBusy((n) => n - 1);
    }
    setBusy(0);
    if (uploaded.length) onUploaded?.(uploaded);
  };

  return (
    <div
      className={`uploader ${drag ? "drag" : ""}`}
      style={compact ? { padding: 24 } : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        upload(e.dataTransfer.files);
      }}
    >
      <h2>Drop files to upload</h2>
      <p className="muted">or</p>
      <button type="button" className="button button-large" onClick={() => input.current?.click()} disabled={busy > 0}>
        {busy > 0 ? `Uploading ${busy} file(s)…` : "Select Files"}
      </button>
      <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      <p className="muted" style={{ marginTop: 12 }}>Maximum upload file size: 10 MB. Allowed: JPG, PNG, WebP, GIF, AVIF, PDF, MP4.</p>
    </div>
  );
}
