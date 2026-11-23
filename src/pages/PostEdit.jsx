import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { del, get, post as apiPost, put, SITE_URL } from "../api.js";
import { useAuth } from "../auth.jsx";
import Editor from "../components/Editor.jsx";
import MediaModal from "../components/MediaModal.jsx";
import { Notice, Postbox, Spinner, useNotice } from "../components/ui.jsx";
import { fmtDate, slugify, STATUS_LABEL, stripTags, toLocalInput } from "../utils.js";

const EMPTY = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  status: "draft",
  publishedAt: null,
  password: "",
  author: null,
  categories: [],
  tags: [],
  featuredImage: null,
  heroImage: null,
  sticky: false,
  trending: false,
  editorsPick: false,
  commentStatus: "open",
  seo: { title: "", description: "", focusKeyword: "", ogImage: "", canonical: "", noindex: false, nofollow: false },
};

/** Hierarchical category checklist */
function CategoryTree({ all, selected, onToggle, parent = null }) {
  const kids = all.filter((c) => String(c.parent || null) === String(parent));
  if (!kids.length) return null;
  return (
    <ul>
      {kids.map((c) => (
        <li key={c._id}>
          <label>
            <input type="checkbox" checked={selected.includes(c._id)} onChange={() => onToggle(c._id)} /> {c.name}
          </label>
          <CategoryTree all={all} selected={selected} onToggle={onToggle} parent={c._id} />
        </li>
      ))}
    </ul>
  );
}

function ImageBox({ label, value, onChange, setText, removeText }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {value?.url ? (
        <div className="feat-img">
          <a onClick={() => setOpen(true)} style={{ cursor: "pointer" }} title="Click to change">
            <img src={value.url} alt={value.alt} />
          </a>
          <p className="help">Click the image to edit or update</p>
          <div className="field"><span>Alt text</span><input type="text" value={value.alt || ""} onChange={(e) => onChange({ ...value, alt: e.target.value })} /></div>
          <button type="button" className="button-link button-link-delete" onClick={() => onChange(null)}>{removeText}</button>
        </div>
      ) : (
        <button type="button" className="button-link" onClick={() => setOpen(true)}>{setText}</button>
      )}
      {open && (
        <MediaModal
          imagesOnly
          title={label}
          buttonLabel={setText}
          onClose={() => setOpen(false)}
          onSelect={(m) => {
            setOpen(false);
            if (m) onChange({ url: m.sizes?.large?.url || m.url, alt: m.alt || "", media: m._id });
          }}
        />
      )}
    </>
  );
}

function SeoScore({ p }) {
  const kw = p.seo.focusKeyword.trim().toLowerCase();
  const text = stripTags(p.content).toLowerCase();
  const title = (p.seo.title || p.title).toLowerCase();
  const desc = (p.seo.description || p.excerpt || "").toLowerCase();
  const words = text ? text.split(/\s+/).length : 0;
  const checks = [
    [Boolean(kw), "Focus keyword set"],
    [kw && title.includes(kw), "Focus keyword in SEO title"],
    [kw && desc.includes(kw), "Focus keyword in meta description"],
    [kw && p.slug.includes(slugify(kw)), "Focus keyword in URL slug"],
    [kw && text.slice(0, 600).includes(kw), "Focus keyword in the first paragraph"],
    [(p.seo.title || p.title).length >= 30 && (p.seo.title || p.title).length <= 60, "SEO title is 30–60 characters"],
    [desc.length >= 120 && desc.length <= 160, "Meta description is 120–160 characters"],
    [words >= 300, `Content has 300+ words (${words})`],
    [/<h2/i.test(p.content), "Uses subheadings (H2)"],
    [/<img[^>]+alt="[^"]+"/i.test(p.content) || Boolean(p.featuredImage?.alt), "Images have alt text"],
    [/href="\/(?!\/)|href="https?:\/\/(www\.)?dara/i.test(p.content), "Has an internal link"],
  ];
  const score = Math.round((checks.filter(([ok]) => ok).length / checks.length) * 100);
  const color = score >= 75 ? "#00a32a" : score >= 45 ? "#dba617" : "#d63638";
  return (
    <div>
      <p style={{ margin: "4px 0" }}><strong>SEO score: <span style={{ color }}>{score}/100</span></strong></p>
      <div className="meter"><div style={{ width: `${score}%`, background: color }} /></div>
      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", lineHeight: 1.8 }}>
        {checks.map(([ok, label]) => (
          <li key={label}>{ok ? "✅" : "⚪"} {label}</li>
        ))}
      </ul>
    </div>
  );
}

const counterColor = (n, lo, hi) => (n === 0 ? "#646970" : n < lo ? "#dba617" : n > hi ? "#d63638" : "#00a32a");

export default function PostEdit() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const { user, can } = useAuth();
  const [p, setP] = useState({ ...EMPTY, author: user._id });
  const [saved, setSaved] = useState(null); // last saved server copy
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [categories, setCategories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [showPopular, setShowPopular] = useState(false);
  const [newCat, setNewCat] = useState({ open: false, name: "", parent: "" });
  const [editing, setEditing] = useState({ status: false, visibility: false, date: false, slug: false });
  const [visibility, setVisibility] = useState("public");
  const [lock, setLock] = useState(null);
  const [autosave, setAutosave] = useState(null);
  const [lastAutosave, setLastAutosave] = useState(null);
  const [revisionCount, setRevisionCount] = useState(0);
  const { notice, show, fail, clear } = useNotice();
  const pRef = useRef(p);
  pRef.current = p;

  const update = (patch) => {
    setP((cur) => ({ ...cur, ...patch }));
    setDirty(true);
  };
  const updateSeo = (patch) => update({ seo: { ...pRef.current.seo, ...patch } });

  const fromServer = (d) => ({
    ...EMPTY,
    ...d,
    author: d.author?._id || d.author,
    categories: (d.categories || []).map((c) => c._id || c),
    tags: (d.tags || []).map((t) => (t._id ? { _id: t._id, name: t.name } : t)),
    seo: { ...EMPTY.seo, ...(d.seo || {}) },
  });

  // Load post + taxonomies
  useEffect(() => {
    get("/admin/categories", { all: 1 }).then((r) => setCategories(r.data)).catch(() => {});
    get("/admin/tags", { all: 1, orderby: "count" }).then((r) => setAllTags(r.data)).catch(() => {});
    if (can("edit_others_posts")) get("/admin/users/authors").then((r) => setAuthors(r.data)).catch(() => {});
    if (isNew) return;
    setLoading(true);
    get(`/admin/posts/${id}`)
      .then((r) => {
        const d = fromServer(r.data);
        setP(d);
        setSaved(d);
        setVisibility(d.status === "private" ? "private" : d.password ? "password" : "public");
        setRevisionCount(r.meta.revisionCount);
        setAutosave(r.meta.autosave);
        setDirty(false);
      })
      .catch(fail)
      .finally(() => setLoading(false));
  }, [id]);

  // Post lock heartbeat (every 60s)
  useEffect(() => {
    if (isNew) return;
    let stop = false;
    const beat = (takeover) =>
      apiPost(`/admin/posts/${id}/lock`, takeover ? { takeover: true } : {})
        .then((r) => !stop && setLock(r.data.locked ? r.data : null))
        .catch(() => {});
    beat();
    const t = setInterval(() => beat(), 60000);
    window.__takeover = () => beat(true);
    return () => {
      stop = true;
      clearInterval(t);
      del(`/admin/posts/${id}/lock`).catch(() => {});
    };
  }, [id]);

  // Autosave every 60s when there are unsaved changes
  useEffect(() => {
    if (isNew) return;
    const t = setInterval(() => {
      if (!dirtyRef.current) return;
      const cur = pRef.current;
      apiPost(`/admin/posts/${id}/autosave`, { title: cur.title, content: cur.content, excerpt: cur.excerpt })
        .then((r) => {
          setLastAutosave(new Date(r.data.savedAt));
          if (r.data.mode === "post") setDirty(false);
        })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, [id]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const h = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const body = useCallback(
    (statusOverride) => {
      const cur = pRef.current;
      const b = {
        title: cur.title,
        content: cur.content,
        excerpt: cur.excerpt,
        slug: cur.slug || undefined,
        status: statusOverride || cur.status,
        publishedAt: cur.publishedAt ? new Date(cur.publishedAt).toISOString() : null,
        password: visibility === "password" ? cur.password : "",
        categories: cur.categories,
        tags: cur.tags.map((t) => t._id),
        featuredImage: cur.featuredImage,
        heroImage: cur.heroImage,
        sticky: cur.sticky,
        trending: cur.trending,
        editorsPick: cur.editorsPick,
        commentStatus: cur.commentStatus,
        seo: cur.seo,
      };
      if (can("edit_others_posts") && cur.author) b.author = cur.author;
      if (b.status === "future") b.status = "publish";
      return b;
    },
    [visibility, can]
  );

  const save = async (statusOverride, successMsg) => {
    setBusy(statusOverride || "save");
    clear();
    try {
      const b = body(statusOverride);
      const r = isNew ? await apiPost("/admin/posts", b) : await put(`/admin/posts/${id}`, b);
      const d = fromServer(r.data);
      setP(d);
      setSaved(d);
      setDirty(false);
      setAutosave(null);
      const st = d.status;
      const view = st === "publish" ? <> <a href={`${SITE_URL}/blog/${d.slug}`} target="_blank" rel="noreferrer">View post</a></> : null;
      const msg =
        successMsg ||
        { publish: "Post published.", future: `Post scheduled for: ${fmtDate(d.publishedAt)}.`, pending: "Post submitted for review.", private: "Post published privately.", draft: "Draft saved." }[st];
      show(<>{saved && saved.status === st && st !== "draft" ? "Post updated." : msg}{view}</>);
      if (isNew) nav(`/posts/${r.data._id}`, { replace: true });
      else get(`/admin/posts/${id}`).then((x) => setRevisionCount(x.meta.revisionCount)).catch(() => {});
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  };

  const preview = async () => {
    try {
      let pid = id;
      if (isNew || dirty) {
        if (isNew) {
          const r = await apiPost("/admin/posts", body("draft"));
          pid = r.data._id;
          nav(`/posts/${pid}`, { replace: true });
        } else if (["draft", "pending"].includes(saved?.status)) {
          await put(`/admin/posts/${id}`, body());
          setDirty(false);
        } else {
          await apiPost(`/admin/posts/${id}/autosave`, { title: p.title, content: p.content, excerpt: p.excerpt });
        }
      }
      if (saved?.status === "publish" && !dirty) return window.open(`${SITE_URL}/blog/${p.slug}`, "_blank");
      const r = await get(`/admin/posts/${pid}/preview-link`);
      window.open(r.data.url, "_blank");
    } catch (e) {
      fail(e);
    }
  };

  const trash = async () => {
    try {
      await apiPost(`/admin/posts/${id}/trash`);
      setDirty(false);
      nav("/posts?trashed=1");
    } catch (e) {
      fail(e);
    }
  };

  const deletePermanently = async () => {
    if (!confirm(`Permanently delete “${p.title || "(no title)"}”?\n\nIts comments and revisions will also be deleted. This cannot be undone.`)) return;
    try {
      await del(`/admin/posts/${id}`, { force: 1 });
      setDirty(false);
      nav("/posts?deleted=1");
    } catch (e) {
      fail(e);
    }
  };

  // ---- Tags ----
  const addTags = async (raw) => {
    const names = raw.split(",").map((t) => t.trim()).filter(Boolean);
    const next = [...pRef.current.tags];
    for (const n of names) {
      if (next.some((t) => t.name.toLowerCase() === n.toLowerCase())) continue;
      let tag = allTags.find((t) => t.name.toLowerCase() === n.toLowerCase());
      if (!tag) {
        try {
          tag = (await apiPost("/admin/tags", { name: n })).data;
          setAllTags((a) => [...a, tag]);
        } catch (e) {
          fail(e);
          continue;
        }
      }
      next.push({ _id: tag._id, name: tag.name });
    }
    update({ tags: next });
    setTagInput("");
  };
  const tagSuggestions = useMemo(() => {
    const q = tagInput.split(",").pop().trim().toLowerCase();
    if (q.length < 2) return [];
    return allTags.filter((t) => t.name.toLowerCase().includes(q) && !p.tags.some((x) => x._id === t._id)).slice(0, 6);
  }, [tagInput, allTags, p.tags]);

  const addCategory = async () => {
    if (!newCat.name.trim()) return;
    try {
      const r = await apiPost("/admin/categories", { name: newCat.name.trim(), parent: newCat.parent || null });
      setCategories((c) => [...c, r.data]);
      update({ categories: [...p.categories, r.data._id] });
      setNewCat({ open: true, name: "", parent: "" });
    } catch (e) {
      fail(e);
    }
  };

  if (loading) return <div className="wrap"><h1 className="page-title">Edit Post</h1><p><Spinner /></p><Notice notice={notice} /></div>;

  const savedStatus = saved?.status || "draft";
  const isLive = ["publish", "future", "private"].includes(savedStatus);
  const future = p.publishedAt && new Date(p.publishedAt) > new Date();
  const canPublish = can("publish_posts");
  let primaryLabel, primaryStatus;
  if (!canPublish) {
    primaryLabel = savedStatus === "pending" ? "Update" : "Submit for Review";
    primaryStatus = "pending";
  } else if (isLive) {
    primaryLabel = "Update";
    primaryStatus = visibility === "private" ? "private" : p.status === "draft" || p.status === "pending" ? p.status : "publish";
  } else {
    primaryLabel = visibility === "private" ? "Publish" : future ? "Schedule" : "Publish";
    primaryStatus = visibility === "private" ? "private" : "publish";
  }
  const permalinkBase = `${SITE_URL}/blog/`;
  const seoTitle = p.seo.title || p.title || "Post title";
  const seoDesc = p.seo.description || p.excerpt || stripTags(p.content).slice(0, 155);

  return (
    <div className="wrap">
      <h1 className="page-title">{isNew ? "Add New Post" : "Edit Post"}</h1>
      {!isNew && <Link to="/posts/new" className="button page-title-action">Add New Post</Link>}
      <Notice notice={notice} onClose={clear} />

      {lock?.locked && (
        <div className="lock-banner" role="alert">
          <span>🔒 <strong>{lock.by?.displayName}</strong> is currently editing this post. If you take over, they will be blocked from saving.</span>
          <span className="flex">
            <Link className="button" to="/posts">Go back</Link>
            <button className="button button-primary" onClick={() => window.__takeover?.()}>Take over</button>
          </span>
        </div>
      )}
      {autosave && (
        <div className="notice notice-warning">
          <p>
            There is an autosave of this post that is more recent than the version below ({fmtDate(autosave.updatedAt)}).{" "}
            <button
              className="button-link"
              onClick={() => {
                update({ title: autosave.title, content: autosave.content, excerpt: autosave.excerpt });
                setAutosave(null);
              }}
            >
              Restore the autosave
            </button>
          </p>
          <button className="dismiss" onClick={() => setAutosave(null)}>×</button>
        </div>
      )}

      <div className="post-body">
        {/* ---------- Main column ---------- */}
        <div>
          <label className="sr-only" htmlFor="title">Add title</label>
          <input
            id="title"
            className="title-input"
            placeholder="Add title"
            value={p.title}
            onChange={(e) => update({ title: e.target.value })}
            onBlur={() => !p.slug && p.title && isNew && update({ slug: slugify(p.title) })}
          />
          <div className="permalink">
            <strong>Permalink:</strong>
            {editing.slug ? (
              <>
                <span>{permalinkBase}</span>
                <input type="text" value={p.slug} onChange={(e) => update({ slug: e.target.value })} style={{ width: 260 }} aria-label="Slug" />
                <button className="button button-small" onClick={() => { update({ slug: slugify(p.slug || p.title) }); setEditing({ ...editing, slug: false }); }}>OK</button>
                <button className="button-link" onClick={() => { update({ slug: saved?.slug || "" }); setEditing({ ...editing, slug: false }); }}>Cancel</button>
              </>
            ) : (
              <>
                {savedStatus === "publish" ? (
                  <a href={`${permalinkBase}${p.slug}`} target="_blank" rel="noreferrer">{permalinkBase}<b>{p.slug}</b>/</a>
                ) : (
                  <span>{permalinkBase}<b>{p.slug || slugify(p.title) || "…"}</b>/</span>
                )}
                <button className="button button-small" onClick={() => { update({ slug: p.slug || slugify(p.title) }); setEditing({ ...editing, slug: true }); }}>Edit</button>
              </>
            )}
          </div>

          <Editor value={p.content} onChange={(html) => update({ content: html })} />
          <p className="muted" style={{ margin: "6px 0 20px" }}>
            {lastAutosave ? `Draft saved at ${lastAutosave.toLocaleTimeString()}. ` : ""}
            {saved?.updatedAt ? `Last edited on ${fmtDate(saved.updatedAt)}.` : ""}
          </p>

          <Postbox title="Excerpt">
            <label className="sr-only" htmlFor="excerpt">Excerpt</label>
            <textarea id="excerpt" rows={3} style={{ width: "100%" }} value={p.excerpt} onChange={(e) => update({ excerpt: e.target.value })} />
            <p className="help">Excerpts are optional hand-crafted summaries of your content, shown on blog cards and under the article title. If empty, the first 55 words are used.</p>
          </Postbox>

          <Postbox title="SEO">
            <div className="snippet" aria-label="Google preview">
              <div className="s-url">{permalinkBase.replace(/^https?:\/\//, "")}{p.slug || slugify(p.title)}</div>
              <div className="s-title">{seoTitle.slice(0, 60)}{seoTitle.length > 60 ? "…" : ""} | DARA Blog</div>
              <div className="s-desc">{seoDesc.slice(0, 160)}{seoDesc.length > 160 ? "…" : ""}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,260px)", gap: 20 }}>
              <div>
                <div className="field">
                  <span>Focus keyword</span>
                  <input type="text" value={p.seo.focusKeyword} onChange={(e) => updateSeo({ focusKeyword: e.target.value })} />
                </div>
                <div className="field">
                  <span>SEO title <small style={{ color: counterColor(p.seo.title.length, 30, 60) }}>({p.seo.title.length}/60)</small></span>
                  <input type="text" value={p.seo.title} placeholder={p.title} onChange={(e) => updateSeo({ title: e.target.value })} />
                </div>
                <div className="field">
                  <span>Meta description <small style={{ color: counterColor(p.seo.description.length, 120, 160) }}>({p.seo.description.length}/160)</small></span>
                  <textarea rows={3} value={p.seo.description} placeholder={p.excerpt} onChange={(e) => updateSeo({ description: e.target.value })} />
                </div>
                <div className="field">
                  <span>Social share image URL</span>
                  <input type="url" value={p.seo.ogImage} placeholder="Defaults to the hero image" onChange={(e) => updateSeo({ ogImage: e.target.value })} />
                </div>
                <div className="field">
                  <span>Canonical URL</span>
                  <input type="url" value={p.seo.canonical} placeholder={`${permalinkBase}${p.slug}`} onChange={(e) => updateSeo({ canonical: e.target.value })} />
                </div>
                <label><input type="checkbox" checked={p.seo.noindex} onChange={(e) => updateSeo({ noindex: e.target.checked })} /> No index (hide from search engines)</label>
                <br />
                <label><input type="checkbox" checked={p.seo.nofollow} onChange={(e) => updateSeo({ nofollow: e.target.checked })} /> No follow links</label>
              </div>
              <SeoScore p={p} />
            </div>
          </Postbox>

          <Postbox title="Discussion">
            <label>
              <input type="checkbox" checked={p.commentStatus === "open"} onChange={(e) => update({ commentStatus: e.target.checked ? "open" : "closed" })} /> Allow comments
            </label>
            {!isNew && saved?.commentCount > 0 && (
              <p><Link to={`/comments?post=${id}`}>View {saved.commentCount} comment(s) on this post →</Link></p>
            )}
          </Postbox>
        </div>

        {/* ---------- Sidebar ---------- */}
        <div>
          <Postbox title="Publish">
            <div className="flex" style={{ justifyContent: "space-between" }}>
              {(!isLive || p.status === "draft") && (
                <button className="button" onClick={() => save(savedStatus === "pending" ? "pending" : "draft")} disabled={Boolean(busy)}>
                  {busy === "draft" ? "Saving…" : savedStatus === "pending" ? "Save as Pending" : "Save Draft"}
                </button>
              )}
              <button className="button" onClick={preview} style={{ marginLeft: "auto" }}>
                {savedStatus === "publish" && !dirty ? "View Post" : "Preview"}
              </button>
            </div>
            <div className="misc-pub-section" style={{ marginTop: 10 }}>
              <span className="label">📌 Status:</span> <strong>{STATUS_LABEL[p.status] || "Draft"}</strong>
              {canPublish && !editing.status && <button className="button-link" onClick={() => setEditing({ ...editing, status: true })}>Edit</button>}
              {editing.status && (
                <span className="flex">
                  <select value={p.status === "future" ? "publish" : p.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
                    {isLive && <option value={savedStatus === "private" ? "private" : "publish"}>{savedStatus === "private" ? "Privately Published" : "Published"}</option>}
                    <option value="pending">Pending Review</option>
                    <option value="draft">Draft</option>
                  </select>
                  <button className="button button-small" onClick={() => setEditing({ ...editing, status: false })}>OK</button>
                </span>
              )}
            </div>
            <div className="misc-pub-section">
              <span className="label">👁 Visibility:</span>{" "}
              <strong>{visibility === "public" ? (p.sticky ? "Public, Sticky" : "Public") : visibility === "password" ? "Password protected" : "Private"}</strong>
              {!editing.visibility && <button className="button-link" onClick={() => setEditing({ ...editing, visibility: true })}>Edit</button>}
              {editing.visibility && (
                <fieldset style={{ border: 0, padding: 0, width: "100%" }}>
                  <label style={{ display: "block" }}><input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} /> Public</label>
                  {visibility === "public" && canPublish && (
                    <label style={{ display: "block", marginLeft: 20 }}><input type="checkbox" checked={p.sticky} onChange={(e) => update({ sticky: e.target.checked })} /> Stick this post to the front page (Featured)</label>
                  )}
                  <label style={{ display: "block" }}><input type="radio" checked={visibility === "password"} onChange={() => setVisibility("password")} /> Password protected</label>
                  {visibility === "password" && (
                    <input type="text" placeholder="Password" value={p.password} onChange={(e) => update({ password: e.target.value })} style={{ margin: "4px 0 4px 20px" }} aria-label="Post password" />
                  )}
                  {canPublish && <label style={{ display: "block" }}><input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} /> Private</label>}
                  <button className="button button-small" style={{ marginTop: 6 }} onClick={() => { setDirty(true); setEditing({ ...editing, visibility: false }); }}>OK</button>
                </fieldset>
              )}
            </div>
            <div className="misc-pub-section">
              <span className="label">📅 {savedStatus === "publish" ? "Published on:" : future ? "Schedule for:" : "Publish"}</span>{" "}
              <strong>{p.publishedAt ? fmtDate(p.publishedAt) : "immediately"}</strong>
              {canPublish && !editing.date && <button className="button-link" onClick={() => setEditing({ ...editing, date: true })}>Edit</button>}
              {editing.date && (
                <span className="flex">
                  <input type="datetime-local" value={toLocalInput(p.publishedAt)} onChange={(e) => update({ publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} aria-label="Publish date" />
                  <button className="button button-small" onClick={() => setEditing({ ...editing, date: false })}>OK</button>
                </span>
              )}
            </div>
            {!isNew && revisionCount > 0 && (
              <div className="misc-pub-section">
                <span className="label">↺ Revisions:</span> <strong>{revisionCount}</strong> <Link to={`/posts/${id}/revisions`}>Browse</Link>
              </div>
            )}
            <div className="major-publishing-actions">
              {!isNew ? (
                <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button className="button-link button-link-delete" onClick={trash}>Move to Trash</button>
                  <button className="button-link button-link-delete" onClick={deletePermanently}>Delete Permanently</button>
                </span>
              ) : (
                <span />
              )}
              <button className="button button-primary button-large" onClick={() => save(primaryStatus)} disabled={Boolean(busy) || (lock && lock.locked)}>
                {busy && busy !== "draft" ? <Spinner /> : primaryLabel}
              </button>
            </div>
          </Postbox>

          {canPublish && (
            <Postbox title="Highlight on Blog">
              <label style={{ display: "block", marginBottom: 6 }}><input type="checkbox" checked={p.sticky} onChange={(e) => update({ sticky: e.target.checked })} /> Featured (sticky)</label>
              <label style={{ display: "block", marginBottom: 6 }}><input type="checkbox" checked={p.trending} onChange={(e) => update({ trending: e.target.checked })} /> Trending Now</label>
              <label style={{ display: "block" }}><input type="checkbox" checked={p.editorsPick} onChange={(e) => update({ editorsPick: e.target.checked })} /> Editor&apos;s Pick</label>
              <p className="help">Controls the sections on the blog home page.</p>
            </Postbox>
          )}

          <Postbox title="Categories">
            <div className="categorychecklist" style={{ paddingLeft: 0 }}>
              <CategoryTree
                all={categories}
                selected={p.categories}
                onToggle={(cid) => update({ categories: p.categories.includes(cid) ? p.categories.filter((x) => x !== cid) : [...p.categories, cid] })}
              />
            </div>
            {can("manage_categories") && (
              <>
                <button className="button-link" onClick={() => setNewCat({ ...newCat, open: !newCat.open })}>+ Add New Category</button>
                {newCat.open && (
                  <div style={{ marginTop: 8 }}>
                    <input type="text" placeholder="New category name" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} style={{ width: "100%", marginBottom: 6 }} aria-label="New category name" />
                    <select value={newCat.parent} onChange={(e) => setNewCat({ ...newCat, parent: e.target.value })} style={{ width: "100%", marginBottom: 6 }} aria-label="Parent category">
                      <option value="">— Parent Category —</option>
                      {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <button className="button" onClick={addCategory}>Add New Category</button>
                  </div>
                )}
              </>
            )}
          </Postbox>

          <Postbox title="Tags">
            <div className="flex" style={{ position: "relative" }}>
              <input
                type="text"
                className="grow"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTags(tagInput);
                  }
                }}
                aria-label="Add new tag"
              />
              <button className="button" onClick={() => addTags(tagInput)}>Add</button>
              {tagSuggestions.length > 0 && (
                <ul style={{ position: "absolute", top: 32, left: 0, right: 50, background: "#fff", border: "1px solid #c3c4c7", listStyle: "none", margin: 0, padding: 0, zIndex: 10 }}>
                  {tagSuggestions.map((t) => (
                    <li key={t._id}>
                      <button type="button" className="button-link" style={{ display: "block", padding: "4px 8px", textDecoration: "none", width: "100%", textAlign: "left" }} onClick={() => addTags(t.name)}>
                        {t.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="help">Separate tags with commas</p>
            <div className="tagchecklist">
              {p.tags.map((t) => (
                <span key={t._id}>
                  <button type="button" aria-label={`Remove tag ${t.name}`} onClick={() => update({ tags: p.tags.filter((x) => x._id !== t._id) })}>×</button>
                  {t.name}
                </span>
              ))}
            </div>
            <p><button className="button-link" onClick={() => setShowPopular(!showPopular)}>Choose from the most used tags</button></p>
            {showPopular && (
              <p style={{ lineHeight: 2 }}>
                {allTags.slice(0, 30).map((t) => (
                  <button key={t._id} type="button" className="button-link" style={{ marginRight: 8, fontSize: 12 + Math.min(6, t.count || 0) }} onClick={() => addTags(t.name)}>
                    {t.name}
                  </button>
                ))}
              </p>
            )}
          </Postbox>

          <Postbox title="Featured Image (card)">
            <ImageBox label="Featured image" value={p.featuredImage} onChange={(v) => update({ featuredImage: v })} setText="Set featured image" removeText="Remove featured image" />
          </Postbox>
          <Postbox title="Hero Image (article top)">
            <ImageBox label="Hero image" value={p.heroImage} onChange={(v) => update({ heroImage: v })} setText="Set hero image" removeText="Remove hero image" />
            <p className="help">Falls back to the featured image when empty.</p>
          </Postbox>

          {can("edit_others_posts") && authors.length > 0 && (
            <Postbox title="Author">
              <label className="sr-only" htmlFor="author">Author</label>
              <select id="author" value={p.author || ""} onChange={(e) => update({ author: e.target.value })} style={{ width: "100%" }}>
                {authors.map((a) => <option key={a._id} value={a._id}>{a.displayName} ({a.username})</option>)}
              </select>
            </Postbox>
          )}
        </div>
      </div>
    </div>
  );
}
