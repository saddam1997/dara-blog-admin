import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get, post, SITE_URL } from "../api.js";
import { Modal, Notice, Pages, Spinner, useNotice } from "../components/ui.jsx";
import { CAMPAIGN_STATUS_LABEL, fmtDate } from "../utils.js";

/** "New blog published" email notifications — one row per post. */
export default function NewsletterCampaigns() {
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get("page") || 1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failures, setFailures] = useState(null); // { campaign, items }
  const { notice, show, fail, clear } = useNotice();

  const load = (quiet = false) => {
    if (!quiet) setLoading(true);
    get("/admin/newsletter/campaigns", { page })
      .then((r) => { setItems(r.data); setMeta(r.meta); })
      .catch(fail)
      .finally(() => setLoading(false));
  };
  useEffect(() => load(), [page]);

  // Refresh while something is still sending.
  const active = items.some((c) => c.status !== "completed");
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => load(true), 10000);
    return () => clearInterval(t);
  }, [active, page]);

  const retry = async (c) => {
    try {
      const r = await post(`/admin/newsletter/campaigns/${c._id}/retry-failed`);
      show(`${r.data.requeued} failed email(s) queued again.`);
      load(true);
    } catch (e) {
      fail(e);
    }
  };
  const openFailures = async (c) => {
    try {
      const r = await get(`/admin/newsletter/campaigns/${c._id}/failures`);
      setFailures({ campaign: c, items: r.data });
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="wrap">
      <h1 className="page-title">Newsletter Notifications</h1>
      <Link to="/newsletter" className="button page-title-action">Subscribers</Link>
      <p style={{ color: "#646970", marginTop: 4 }}>
        An email is sent to every active subscriber automatically when a post is published for the first time. Edits and re-publishing do not send again.
      </p>
      <Notice notice={notice} onClose={clear} />
      <div className="tablenav">
        <div className="actions" />
        <Pages meta={meta} page={page} setPage={(n) => setSp({ page: String(n) })} />
      </div>
      <table className="widefat">
        <thead>
          <tr>
            <th>Post</th>
            <th>Status</th>
            <th>Recipients</th>
            <th>Sent</th>
            <th className="hide-sm">Queued</th>
            <th>Failed</th>
            <th className="hide-sm">Skipped</th>
            <th className="hide-sm">Started</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr className="no-items"><td colSpan={8}><Spinner /></td></tr>}
          {!loading && items.length === 0 && <tr className="no-items"><td colSpan={8}>No notifications sent yet. Publish a post to notify subscribers.</td></tr>}
          {!loading && items.map((c) => {
            const t = c.totals;
            return (
              <tr key={c._id}>
                <td>
                  <strong>
                    {c.post ? <Link className="row-title" to={`/posts/${c.post._id}`}>{c.post.title || c.snapshot?.title}</Link> : c.snapshot?.title || "(deleted post)"}
                  </strong>
                  <div className="row-actions">
                    {c.snapshot?.slug && <span><a href={`${SITE_URL}/blog/${c.snapshot.slug}`} target="_blank" rel="noreferrer">View post</a></span>}
                    {t.failed > 0 && <span><button onClick={() => openFailures(c)}>See failures</button></span>}
                    {t.failed > 0 && <span><button onClick={() => retry(c)}>Retry failed</button></span>}
                  </div>
                </td>
                <td>{CAMPAIGN_STATUS_LABEL[c.status] || c.status}</td>
                <td>{t.recipients}</td>
                <td>{t.sent}</td>
                <td className="hide-sm">{t.queued}</td>
                <td style={t.failed ? { color: "var(--danger)", fontWeight: 600 } : undefined}>{t.failed}</td>
                <td className="hide-sm">{t.skipped}</td>
                <td className="hide-sm">{fmtDate(c.startedAt || c.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {failures && (
        <Modal
          title={`Failed emails — ${failures.campaign.snapshot?.title || ""}`}
          onClose={() => setFailures(null)}
          footer={
            <>
              <button className="button" onClick={() => setFailures(null)}>Close</button>
              <button className="button button-primary" onClick={() => { retry(failures.campaign); setFailures(null); }}>Retry failed</button>
            </>
          }
        >
          <table className="widefat">
            <thead><tr><th>Email</th><th>Attempts</th><th>Error</th><th>When</th></tr></thead>
            <tbody>
              {failures.items.map((d) => (
                <tr key={d._id}><td>{d.email}</td><td>{d.attempts}</td><td style={{ fontSize: 12 }}>{d.lastError}</td><td>{fmtDate(d.updatedAt)}</td></tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}
