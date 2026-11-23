import { useState } from "react";
import { api } from "../api.js";
import { Notice, useNotice } from "../components/ui.jsx";

export default function Tools() {
  const [busy, setBusy] = useState(false);
  const { notice, show, fail, clear } = useNotice();

  const exportJson = async () => {
    setBusy(true);
    try {
      const res = await api("/admin/export", { raw: true });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `dara-blog-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      show("Export file downloaded.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <h1 className="page-title">Tools</h1>
      <Notice notice={notice} onClose={clear} />
      <div className="postbox" style={{ maxWidth: 700, marginTop: 16 }}>
        <h2 className="hndle">Export</h2>
        <div className="inside">
          <p>Download a JSON file with all posts, categories, tags and users (without passwords). Keep it as a backup.</p>
          <button className="button button-primary" onClick={exportJson} disabled={busy}>{busy ? "Preparing…" : "Download Export File"}</button>
        </div>
      </div>
      <div className="postbox" style={{ maxWidth: 700 }}>
        <h2 className="hndle">Site Health</h2>
        <div className="inside">
          <p>RSS feed: <a href="/feed" target="_blank" rel="noreferrer">/feed</a> · Sitemap: <a href="/blog-sitemap.xml" target="_blank" rel="noreferrer">/blog-sitemap.xml</a> · API health: <a href="/health" target="_blank" rel="noreferrer">/health</a></p>
        </div>
      </div>
    </div>
  );
}
