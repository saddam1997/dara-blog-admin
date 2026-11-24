import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { del, get, post } from "../api.js";
import { Modal, Notice, Pages, SearchBox, Spinner, useNotice, useSelection } from "../components/ui.jsx";
import { fmtDate, SUBSCRIBER_STATUS_LABEL, UNSUBSCRIBE_REASON_LABEL } from "../utils.js";

const SOURCE_LABEL = { popup: "Popup", footer: "Footer", blog: "Blog", admin: "Admin", other: "Other" };

export default function NewsletterSubscribers() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get("status") || "all";
  const page = Number(sp.get("page") || 1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bulk, setBulk] = useState("");
  const [confirm, setConfirm] = useState(null); // { action: "unsubscribe" | "delete", subs: [] }
  const [busy, setBusy] = useState(false);
  const sel = useSelection(items);
  const { notice, show, fail, clear } = useNotice();

  const setParam = (patch) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    if (!("page" in patch)) n.delete("page");
    setSp(n);
  };
  const load = () => {
    setLoading(true);
    get("/admin/newsletter/subscribers", {
      status: status === "all" ? "" : status,
      page,
      q: sp.get("s"),
      orderby: sp.get("orderby"),
      order: sp.get("order"),
    })
      .then((r) => { setItems(r.data); setMeta(r.meta); })
      .catch(fail)
      .finally(() => setLoading(false));
    sel.clear();
  };
  useEffect(load, [sp.toString()]);

  const sortBy = (f) => setParam({ orderby: f, order: sp.get("orderby") === f && sp.get("order") !== "asc" ? "asc" : "desc" });

  const applyBulk = () => {
    const subs = items.filter((s) => sel.has(s._id));
    if (!bulk || !subs.length) return;
    setConfirm({ action: bulk, subs: bulk === "unsubscribe" ? subs.filter((s) => s.status === "active") : subs });
  };

  const runConfirm = async () => {
    const { action, subs } = confirm;
    setBusy(true);
    try {
      if (subs.length === 1) {
        if (action === "delete") await del(`/admin/newsletter/subscribers/${subs[0]._id}`);
        else await post(`/admin/newsletter/subscribers/${subs[0]._id}/unsubscribe`);
      } else if (subs.length > 1) {
        await post("/admin/newsletter/subscribers/bulk", { ids: subs.map((s) => s._id), action });
      }
      show(action === "delete" ? `${subs.length} subscriber(s) permanently deleted.` : `${subs.length} subscriber(s) unsubscribed. They will not receive any more emails.`);
      setBulk("");
      load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const counts = meta?.counts || {};
  return (
    <div className="wrap">
      <h1 className="page-title">Newsletter Subscribers</h1>
      <Link to="/newsletter/campaigns" className="button page-title-action">View Notifications</Link>
      <Notice notice={notice} onClose={clear} />
      <div className="toprow">
        <ul className="subsubsub">
          {["all", "active", "unsubscribed"].map((s) => (
            <li key={s}>
              <a className={status === s ? "current" : ""} onClick={() => setParam({ status: s === "all" ? "" : s })}>
                {s === "all" ? "All" : SUBSCRIBER_STATUS_LABEL[s]} <span className="count">({counts[s] || 0})</span>
              </a>
            </li>
          ))}
        </ul>
        <SearchBox value={sp.get("s")} onSearch={(s) => setParam({ s })} label="Search Subscribers" />
      </div>
      <div className="tablenav">
        <div className="actions">
          <select value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Bulk actions">
            <option value="">Bulk actions</option>
            <option value="unsubscribe">Unsubscribe</option>
            <option value="delete">Delete permanently</option>
          </select>
          <button className="button" disabled={!sel.selected.length || !bulk} onClick={applyBulk}>Apply</button>
        </div>
        <Pages meta={meta} page={page} setPage={(n) => setParam({ page: String(n) })} />
      </div>
      <table className="widefat">
        <thead>
          <tr>
            <td className="check-column"><input type="checkbox" checked={sel.all} onChange={sel.toggleAll} aria-label="Select all" /></td>
            <th className="sortable" onClick={() => sortBy("email")}>Email</th>
            <th className="sortable" onClick={() => sortBy("status")}>Status</th>
            <th className="hide-sm">Source</th>
            <th className="sortable" onClick={() => sortBy("subscribed")}>Subscribed</th>
            <th className="hide-sm">Unsubscribed</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr className="no-items"><td colSpan={6}><Spinner /></td></tr>}
          {!loading && items.length === 0 && <tr className="no-items"><td colSpan={6}>No subscribers found.</td></tr>}
          {!loading && items.map((s) => (
            <tr key={s._id}>
              <th className="check-column">
                <input type="checkbox" checked={sel.has(s._id)} onChange={() => sel.toggle(s._id)} aria-label={`Select ${s.email}`} />
              </th>
              <td>
                <strong>{s.email}</strong>
                <div className="row-actions">
                  {s.status === "active" && (
                    <span className="trash"><button onClick={() => setConfirm({ action: "unsubscribe", subs: [s] })}>Unsubscribe</button></span>
                  )}
                  <span className="delete"><button onClick={() => setConfirm({ action: "delete", subs: [s] })}>Delete permanently</button></span>
                </div>
              </td>
              <td>
                {s.status === "active" ? <span style={{ color: "#008a20", fontWeight: 600 }}>Active</span> : <span className="post-state">Unsubscribed</span>}
              </td>
              <td className="hide-sm">
                {SOURCE_LABEL[s.source] || s.source}
                {s.sourcePath && <div className="description" style={{ fontSize: 12, color: "#646970" }}>{s.sourcePath}</div>}
              </td>
              <td>{fmtDate(s.subscribedAt)}</td>
              <td className="hide-sm">
                {s.unsubscribedAt ? (
                  <>
                    {fmtDate(s.unsubscribedAt)}
                    <div style={{ fontSize: 12, color: "#646970" }}>{UNSUBSCRIBE_REASON_LABEL[s.unsubscribeReason] || ""}</div>
                  </>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tablenav bottom">
        <Pages meta={meta} page={page} setPage={(n) => setParam({ page: String(n) })} />
      </div>

      {confirm && (
        <Modal
          size="small"
          title={confirm.action === "delete" ? "Delete Subscribers Permanently" : "Unsubscribe Subscribers"}
          onClose={() => !busy && setConfirm(null)}
          footer={
            <>
              <button className="button" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button className="button button-primary" disabled={busy || !confirm.subs.length} onClick={runConfirm}>
                {busy ? "Working…" : confirm.action === "delete" ? "Delete Permanently" : "Unsubscribe"}
              </button>
            </>
          }
        >
          {confirm.subs.length === 0 ? (
            <p>None of the selected subscribers are active.</p>
          ) : (
            <>
              <p>
                {confirm.action === "delete"
                  ? "These subscribers and their email history will be removed permanently. This cannot be undone. Use this for data-erasure requests; otherwise prefer Unsubscribe."
                  : "These subscribers will stop receiving blog notification emails immediately, including emails that are still queued. Their record is kept as history."}
              </p>
              <ul style={{ maxHeight: 200, overflow: "auto" }}>
                {confirm.subs.slice(0, 50).map((s) => <li key={s._id}>{s.email}</li>)}
                {confirm.subs.length > 50 && <li>…and {confirm.subs.length - 50} more</li>}
              </ul>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
