import { useEffect, useState } from "react";
import { get } from "../api.js";
import { Notice, Pages, Spinner, useNotice } from "../components/ui.jsx";
import { fmtDate, timeAgo } from "../utils.js";

const LABEL = (a) => a.replace(/\./g, " → ").replace(/_/g, " ");

export default function Activity() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [loading, setLoading] = useState(true);
  const { notice, fail } = useNotice();

  useEffect(() => {
    setLoading(true);
    get("/admin/activity", { page, entity, limit: 50 })
      .then((r) => { setItems(r.data); setMeta(r.meta); })
      .catch(fail)
      .finally(() => setLoading(false));
  }, [page, entity]);

  return (
    <div className="wrap">
      <h1 className="page-title">Activity Log</h1>
      <Notice notice={notice} />
      <div className="tablenav">
        <div className="actions">
          <select value={entity} onChange={(e) => { setPage(1); setEntity(e.target.value); }} aria-label="Filter">
            <option value="">All activity</option>
            {["post", "category", "tag", "media", "comment", "user", "settings"].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <Pages meta={meta} page={page} setPage={setPage} />
      </div>
      <table className="widefat">
        <thead><tr><th>When</th><th>User</th><th>Action</th><th>Item</th></tr></thead>
        <tbody>
          {loading && <tr className="no-items"><td colSpan={4}><Spinner /></td></tr>}
          {!loading && items.length === 0 && <tr className="no-items"><td colSpan={4}>No activity yet.</td></tr>}
          {!loading && items.map((a) => (
            <tr key={a._id}>
              <td title={fmtDate(a.createdAt)}>{timeAgo(a.createdAt)}</td>
              <td>{a.user?.displayName || <span className="muted">System</span>}</td>
              <td><span className="badge">{LABEL(a.action)}</span></td>
              <td>{a.label || (a.meta?.count != null ? `${a.meta.count} item(s)` : "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
