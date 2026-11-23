import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { get, post } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Notice, Postbox, Spinner, useNotice } from "../components/ui.jsx";
import { fmtDate, stripTags } from "../utils.js";

export default function Dashboard() {
  const { user, can } = useAuth();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [saving, setSaving] = useState(false);
  const [hideWelcome, setHideWelcome] = useState(() => localStorage.getItem("dara_hide_welcome") === "1");
  const { notice, show, fail, clear } = useNotice();
  const nav = useNavigate();

  const load = () => get("/admin/dashboard").then((r) => setData(r.data)).catch(fail);
  useEffect(() => {
    load();
  }, []);

  const saveDraft = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await post("/admin/dashboard/quick-draft", draft);
      setDraft({ title: "", content: "" });
      show("Draft saved.");
      load();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div className="wrap"><h1 className="page-title">Dashboard</h1><p><Spinner /></p><Notice notice={notice} /></div>;
  const g = data.atAGlance;

  return (
    <div className="wrap">
      <h1 className="page-title">Dashboard</h1>
      <Notice notice={notice} onClose={clear} />

      {!hideWelcome && (
        <div className="welcome">
          <button className="button-link" style={{ position: "absolute", right: 16, top: 12 }} onClick={() => { localStorage.setItem("dara_hide_welcome", "1"); setHideWelcome(true); }}>
            Dismiss
          </button>
          <h2>Welcome to the DARA Blog, {user.displayName}!</h2>
          <p className="muted">Here are some links to get you started:</p>
          <div className="cols">
            <div>
              <h3>Get Started</h3>
              <button className="button button-primary button-large" onClick={() => nav("/posts/new")}>Write your first blog post</button>
            </div>
            <div>
              <h3>Next Steps</h3>
              <ul>
                <li><Link to="/posts/new">Add a blog post</Link></li>
                {can("manage_categories") && <li><Link to="/categories">Manage categories</Link></li>}
                {can("upload_files") && <li><Link to="/media">Upload images</Link></li>}
              </ul>
            </div>
            <div>
              <h3>More Actions</h3>
              <ul>
                {can("moderate_comments") && <li><Link to="/comments">Moderate comments</Link></li>}
                {can("manage_options") && <li><Link to="/settings/general">Blog settings</Link></li>}
                <li><Link to="/profile">Edit your profile</Link></li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="dash-grid">
        <Postbox title="At a Glance">
          <ul className="glance">
            <li><Link to="/posts?status=publish">📝 {g.posts} Post{g.posts === 1 ? "" : "s"}</Link></li>
            <li><Link to="/posts?status=draft">🗒 {g.drafts} Draft{g.drafts === 1 ? "" : "s"}</Link></li>
            <li><Link to="/comments">💬 {g.comments} Comment{g.comments === 1 ? "" : "s"}</Link></li>
            <li><Link to="/comments?status=pending">⏳ {g.pendingComments} in moderation</Link></li>
            <li><Link to="/posts?status=future">🕒 {g.scheduled} Scheduled</Link></li>
            <li><Link to="/posts?status=pending">👀 {g.pending} Pending review</Link></li>
            {can("manage_categories") && <li><Link to="/categories">📂 {g.categories} Categories</Link></li>}
            <li><Link to="/tags">🏷 {g.tags} Tags</Link></li>
            {can("upload_files") && <li><Link to="/media">🖼 {g.media} Media files</Link></li>}
            <li><span>👁 {g.totalViews.toLocaleString()} Total views</span></li>
          </ul>
        </Postbox>

        <Postbox title="Activity">
          {data.activity.scheduled.length > 0 && (
            <>
              <h3 className="mt-0" style={{ fontSize: 14, fontWeight: 400, color: "#646970" }}>Publishing Soon</h3>
              <ul className="activity-list">
                {data.activity.scheduled.map((p) => (
                  <li key={p._id}><span className="when">{fmtDate(p.publishedAt)}</span><Link to={`/posts/${p._id}`}>{p.title || "(no title)"}</Link></li>
                ))}
              </ul>
            </>
          )}
          <h3 className="mt-0" style={{ fontSize: 14, fontWeight: 400, color: "#646970" }}>Recently Published</h3>
          <ul className="activity-list">
            {data.activity.recentPublished.length === 0 && <li className="muted">No posts yet.</li>}
            {data.activity.recentPublished.map((p) => (
              <li key={p._id}><span className="when">{fmtDate(p.publishedAt)}</span><Link to={`/posts/${p._id}`}>{p.title || "(no title)"}</Link></li>
            ))}
          </ul>
          {data.activity.recentComments.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 400, color: "#646970" }}>Recent Comments</h3>
              <ul className="activity-list" style={{ display: "block" }}>
                {data.activity.recentComments.map((c) => (
                  <li key={c._id} style={{ display: "block", padding: "6px 0", borderBottom: "1px solid #f0f0f1" }}>
                    From <strong>{c.authorName}</strong> on <Link to={`/posts/${c.post?._id}`}>{c.post?.title}</Link>{" "}
                    {c.status === "pending" && <span className="badge yellow">Pending</span>}
                    <div className="muted">{c.content.slice(0, 120)}</div>
                  </li>
                ))}
              </ul>
              <Link to="/comments">View all comments</Link>
            </>
          )}
        </Postbox>

        <Postbox title="Quick Draft">
          <form onSubmit={saveDraft}>
            <div className="field">
              <label className="lbl" htmlFor="qd-title">Title</label>
              <input id="qd-title" type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="field">
              <label className="lbl" htmlFor="qd-content">Content</label>
              <textarea id="qd-content" rows={4} placeholder="What's on your mind?" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            </div>
            <button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save Draft"}</button>
          </form>
          {data.drafts.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 400, color: "#646970" }}>Your Recent Drafts</h3>
              <ul className="activity-list" style={{ display: "block" }}>
                {data.drafts.map((d) => (
                  <li key={d._id} style={{ display: "block" }}>
                    <Link to={`/posts/${d._id}`}>{d.title || "(no title)"}</Link> <span className="muted">{fmtDate(d.updatedAt, false)}</span>
                    <div className="muted">{stripTags(d.excerpt).slice(0, 80)}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Postbox>

        <Postbox title="Top Posts (by views)">
          <table className="widefat" style={{ border: 0, boxShadow: "none" }}>
            <tbody>
              {data.topPosts.length === 0 && <tr><td className="muted">No published posts yet.</td></tr>}
              {data.topPosts.map((p) => (
                <tr key={p._id}>
                  <td><Link to={`/posts/${p._id}`}>{p.title}</Link></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>👁 {p.views} · 💬 {p.commentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Postbox>
      </div>
    </div>
  );
}
