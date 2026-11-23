import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { get, put } from "../api.js";
import { Notice, Spinner, useNotice } from "../components/ui.jsx";

const TABS = { general: "General", reading: "Reading", discussion: "Discussion", media: "Media" };
const TIMEZONES = ["Asia/Kolkata", "America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Dubai", "UTC"];

export default function Settings() {
  const { tab = "general" } = useParams();
  const [s, setS] = useState(null);
  const [cats, setCats] = useState([]);
  const [busy, setBusy] = useState(false);
  const { notice, show, fail, clear } = useNotice();

  useEffect(() => {
    get("/admin/settings").then((r) => setS(r.data)).catch(fail);
    get("/admin/categories", { all: 1 }).then((r) => setCats(r.data)).catch(() => {});
  }, []);
  if (!s) return <div className="wrap"><h1 className="page-title">Settings</h1><Notice notice={notice} /><p><Spinner /></p></div>;
  const set = (patch) => setS({ ...s, ...patch });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await put("/admin/settings", s);
      setS(r.data);
      show("Settings saved.");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <h1 className="page-title">{TABS[tab]} Settings</h1>
      <nav className="nav-tab-wrapper">
        {Object.entries(TABS).map(([k, v]) => <Link key={k} to={`/settings/${k}`} className={`nav-tab ${tab === k ? "nav-tab-active" : ""}`}>{v}</Link>)}
      </nav>
      <Notice notice={notice} onClose={clear} />
      <form onSubmit={save}>
        <table className="form-table"><tbody>
          {tab === "general" && (
            <>
              <tr><th><label htmlFor="bt">Blog Title</label></th><td><input id="bt" type="text" value={s.blogTitle} onChange={(e) => set({ blogTitle: e.target.value })} /></td></tr>
              <tr><th><label htmlFor="tl">Tagline</label></th><td><input id="tl" type="text" value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} /><p className="help">In a few words, explain what this blog is about. Used in the RSS feed.</p></td></tr>
              <tr><th><label htmlFor="ae">Administration Email Address</label></th><td><input id="ae" type="email" value={s.adminEmail} onChange={(e) => set({ adminEmail: e.target.value })} /><p className="help">Used for admin notifications (e.g. new comments) once email is configured.</p></td></tr>
              <tr><th><label htmlFor="tz">Timezone</label></th><td><select id="tz" value={s.timezone} onChange={(e) => set({ timezone: e.target.value })}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select></td></tr>
              <tr><th>Date Format</th><td><fieldset>
                {["MMMM D, YYYY", "YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"].map((f) => <label key={f}><input type="radio" checked={s.dateFormat === f} onChange={() => set({ dateFormat: f })} /> {f}</label>)}
              </fieldset></td></tr>
              <tr><th>Permalink structure</th><td><code>/blog/%postname%</code><p className="help">Fixed to match the DARA website routes. Changing a slug keeps a 301 redirect from the old URL.</p></td></tr>
            </>
          )}
          {tab === "reading" && (
            <>
              <tr><th><label htmlFor="ppp">Blog pages show at most</label></th><td><input id="ppp" className="small-text" type="number" min={1} max={50} value={s.postsPerPage} onChange={(e) => set({ postsPerPage: Number(e.target.value) })} /> posts</td></tr>
              <tr><th><label htmlFor="dc">Default Post Category</label></th><td>
                <select id="dc" value={s.defaultCategory || ""} onChange={(e) => set({ defaultCategory: e.target.value || null })}>
                  <option value="">Uncategorized</option>
                  {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </td></tr>
              <tr><th><label htmlFor="td">Trash</label></th><td>Automatically delete posts in Trash after <input id="td" className="small-text" type="number" min={0} value={s.trashDays} onChange={(e) => set({ trashDays: Number(e.target.value) })} /> days <p className="help">0 = never.</p></td></tr>
            </>
          )}
          {tab === "discussion" && (
            <>
              <tr><th>Default post settings</th><td><fieldset>
                <label><input type="checkbox" checked={s.commentsEnabled} onChange={(e) => set({ commentsEnabled: e.target.checked })} /> Allow people to submit comments on new posts</label>
              </fieldset></td></tr>
              <tr><th>Other comment settings</th><td><fieldset>
                <label>Automatically close comments on posts older than <input className="small-text" type="number" min={0} value={s.closeCommentsAfterDays} onChange={(e) => set({ closeCommentsAfterDays: Number(e.target.value) })} /> days (0 = never)</label>
                <label>Enable threaded (nested) comments <select value={s.threadDepth} onChange={(e) => set({ threadDepth: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n}>{n}</option>)}</select> levels deep</label>
              </fieldset></td></tr>
              <tr><th>Before a comment appears</th><td><fieldset>
                <label><input type="checkbox" checked={s.commentModeration} onChange={(e) => set({ commentModeration: e.target.checked })} /> Comment must be manually approved</label>
                <label><input type="checkbox" checked={s.commentPreviouslyApproved} onChange={(e) => set({ commentPreviouslyApproved: e.target.checked })} /> Comment author must have a previously approved comment</label>
              </fieldset></td></tr>
              <tr><th>Comment Moderation</th><td>Hold a comment in the queue if it contains <input className="small-text" type="number" min={0} value={s.maxLinksInComment} onChange={(e) => set({ maxLinksInComment: Number(e.target.value) })} /> or more links.</td></tr>
              <tr><th><label htmlFor="bw">Disallowed Comment Keys</label></th><td>
                <textarea id="bw" rows={6} value={(s.blockedWords || []).join("\n")} onChange={(e) => set({ blockedWords: e.target.value.split("\n").map((w) => w.trim()).filter(Boolean) })} />
                <p className="help">When a comment contains any of these words in its content, author name, URL or email, it will be put in Spam. One word or IP per line.</p>
              </td></tr>
            </>
          )}
          {tab === "media" && (
            <>
              <tr><th colSpan={2} style={{ paddingBottom: 0 }}>Image sizes <p className="help" style={{ fontWeight: 400 }}>The sizes listed below determine the maximum dimensions in pixels to use when adding an image. Applies to new uploads.</p></th></tr>
              {["thumbnail", "medium", "large"].map((k) => (
                <tr key={k}><th><label htmlFor={`is-${k}`}>{k[0].toUpperCase() + k.slice(1)} size</label></th><td>
                  Max width <input id={`is-${k}`} className="small-text" type="number" min={50} max={4000} value={s.imageSizes?.[k] || ""} onChange={(e) => set({ imageSizes: { ...s.imageSizes, [k]: Number(e.target.value) } })} /> px
                  {k === "thumbnail" && <p className="help">Thumbnails are cropped to an exact square.</p>}
                </td></tr>
              ))}
            </>
          )}
        </tbody></table>
        <p><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button></p>
      </form>
    </div>
  );
}
