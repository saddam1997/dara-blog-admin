import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { get, post, put } from "../api.js";
import { useAuth } from "../auth.jsx";
import MediaModal from "../components/MediaModal.jsx";
import { Notice, Spinner, useNotice } from "../components/ui.jsx";
import { ROLE_LABEL } from "../utils.js";

const strength = (pw) => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return [["Very weak", "#d63638"], ["Weak", "#d63638"], ["Medium", "#dba617"], ["Medium", "#dba617"], ["Strong", "#00a32a"], ["Strong", "#00a32a"]][s];
};
const genPassword = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const arr = new Uint32Array(18);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => c[n % c.length]).join("");
};

export default function UserEdit({ isNew, profile }) {
  const params = useParams();
  const { user: me, can, setUser } = useAuth();
  const nav = useNavigate();
  const id = profile ? me._id : params.id;
  const [u, setU] = useState(isNew ? { username: "", email: "", firstName: "", lastName: "", website: "", role: "author", password: genPassword(), bio: "", displayName: "", social: {} } : null);
  const [pw, setPw] = useState({ show: false, value: "", current: "" });
  const [avatarPicker, setAvatarPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const { notice, show, fail, clear } = useNotice();

  useEffect(() => {
    if (isNew) return;
    get(`/admin/users/${id}`).then((r) => setU({ social: {}, ...r.data })).catch(fail);
  }, [id]);

  if (!u) return <div className="wrap"><h1 className="page-title">{profile ? "Profile" : "Edit User"}</h1><Notice notice={notice} /><p><Spinner /></p></div>;
  const set = (patch) => setU({ ...u, ...patch });
  const self = u._id === me._id;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    clear();
    try {
      if (isNew) {
        const { social, ...body } = u;
        const r = await post("/admin/users", { ...body, displayName: body.displayName || undefined });
        show("New user created.");
        nav(`/users/${r.data._id}`);
        return;
      }
      const body = {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        displayName: u.displayName,
        website: u.website,
        bio: u.bio,
        avatar: u.avatar,
        social: u.social,
      };
      if (can("edit_users") && !self) Object.assign(body, { role: u.role, status: u.status });
      if (pw.show && pw.value) {
        body.password = pw.value;
        if (self) body.currentPassword = pw.current;
      }
      const r = await put(`/admin/users/${u._id}`, body);
      setU({ social: {}, ...r.data });
      if (self) setUser(r.data);
      setPw({ show: false, value: "", current: "" });
      show(self ? "Profile updated." : "User updated.");
      if (self && body.password) show("Profile updated. Your password changed — other sessions were logged out.");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const st = strength(isNew ? u.password : pw.value);
  const displayOptions = [...new Set([u.username, u.firstName, u.lastName, [u.firstName, u.lastName].filter(Boolean).join(" "), [u.lastName, u.firstName].filter(Boolean).join(" "), u.displayName].filter(Boolean))];

  return (
    <div className="wrap">
      <h1 className="page-title">{isNew ? "Add New User" : profile ? "Profile" : `Edit User ${u.username}`}</h1>
      {!isNew && !profile && can("create_users") && <Link to="/users/new" className="button page-title-action">Add New User</Link>}
      <Notice notice={notice} onClose={clear} />
      {isNew && <p>Create a brand new user and add them to this blog.</p>}
      <form onSubmit={submit}>
        <h2>Name</h2>
        <table className="form-table"><tbody>
          <tr><th><label htmlFor="username">Username {isNew && "(required)"}</label></th><td><input id="username" type="text" value={u.username} disabled={!isNew} required onChange={(e) => set({ username: e.target.value })} />{!isNew && <p className="help">Usernames cannot be changed.</p>}</td></tr>
          {can("edit_users") && !self && (
            <tr><th><label htmlFor="role">Role</label></th><td>
              <select id="role" value={u.role} onChange={(e) => set({ role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <p className="help">
                <b>Administrator</b>: everything · <b>Editor</b>: all posts, categories, comments · <b>Author</b>: publish own posts, upload · <b>Contributor</b>: write drafts, can’t publish · <b>Subscriber</b>: profile only
              </p>
            </td></tr>
          )}
          <tr><th><label htmlFor="first">First Name</label></th><td><input id="first" type="text" value={u.firstName || ""} onChange={(e) => set({ firstName: e.target.value })} /></td></tr>
          <tr><th><label htmlFor="last">Last Name</label></th><td><input id="last" type="text" value={u.lastName || ""} onChange={(e) => set({ lastName: e.target.value })} /></td></tr>
          {!isNew && (
            <tr><th><label htmlFor="display">Display name publicly as</label></th><td>
              <select id="display" value={u.displayName} onChange={(e) => set({ displayName: e.target.value })}>{displayOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            </td></tr>
          )}
        </tbody></table>

        <h2>Contact Info</h2>
        <table className="form-table"><tbody>
          <tr><th><label htmlFor="email">Email (required)</label></th><td><input id="email" type="email" required value={u.email} onChange={(e) => set({ email: e.target.value })} /></td></tr>
          <tr><th><label htmlFor="url">Website</label></th><td><input id="url" type="url" value={u.website || ""} onChange={(e) => set({ website: e.target.value })} /></td></tr>
          {!isNew && ["twitter", "facebook", "linkedin", "instagram"].map((k) => (
            <tr key={k}><th><label htmlFor={k}>{k[0].toUpperCase() + k.slice(1)} URL</label></th><td><input id={k} type="url" value={u.social?.[k] || ""} onChange={(e) => set({ social: { ...u.social, [k]: e.target.value } })} /></td></tr>
          ))}
        </tbody></table>

        {!isNew && (
          <>
            <h2>About {self ? "Yourself" : "the user"}</h2>
            <table className="form-table"><tbody>
              <tr><th><label htmlFor="bio">Biographical Info</label></th><td><textarea id="bio" rows={5} value={u.bio || ""} onChange={(e) => set({ bio: e.target.value })} /><p className="help">Shown in the author box under the user’s articles.</p></td></tr>
              <tr><th>Profile Picture</th><td>
                <div className="flex">
                  <span style={{ width: 96, height: 96, background: "#dcdcde", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 36, overflow: "hidden" }}>
                    {u.avatar ? <img src={u.avatar} alt="" width={96} height={96} style={{ objectFit: "cover" }} /> : u.displayName?.[0]?.toUpperCase()}
                  </span>
                  {can("upload_files") && <button type="button" className="button" onClick={() => setAvatarPicker(true)}>Choose image</button>}
                  {u.avatar && <button type="button" className="button-link button-link-delete" onClick={() => set({ avatar: "" })}>Remove</button>}
                </div>
              </td></tr>
            </tbody></table>
          </>
        )}

        <h2>Account Management</h2>
        <table className="form-table"><tbody>
          {isNew ? (
            <tr><th><label htmlFor="pass">Password</label></th><td>
              <div className="flex"><input id="pass" type="text" value={u.password} onChange={(e) => set({ password: e.target.value })} minLength={8} required /><button type="button" className="button" onClick={() => set({ password: genPassword() })}>Generate</button></div>
              <p style={{ color: st[1], fontWeight: 600, margin: "4px 0" }}>{st[0]}</p>
              <p className="help">Share this password with the user securely; they can change it from their profile.</p>
            </td></tr>
          ) : (
            <tr><th>New Password</th><td>
              {!pw.show ? (
                <button type="button" className="button" onClick={() => setPw({ show: true, value: genPassword(), current: "" })}>Set New Password</button>
              ) : (
                <>
                  {self && <div className="field"><label className="lbl" htmlFor="cur">Current password</label><input id="cur" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" /></div>}
                  <div className="flex"><input type="text" value={pw.value} onChange={(e) => setPw({ ...pw, value: e.target.value })} minLength={8} aria-label="New password" autoComplete="new-password" /><button type="button" className="button" onClick={() => setPw({ show: false, value: "", current: "" })}>Cancel</button></div>
                  <p style={{ color: st[1], fontWeight: 600, margin: "4px 0" }}>{st[0]}</p>
                  <p className="help">Changing the password logs this user out everywhere else.</p>
                </>
              )}
            </td></tr>
          )}
          {!isNew && can("edit_users") && !self && (
            <tr><th>Account status</th><td>
              <label><input type="checkbox" checked={u.status === "disabled"} onChange={(e) => set({ status: e.target.checked ? "disabled" : "active" })} /> Disable this account (user cannot log in)</label>
            </td></tr>
          )}
        </tbody></table>

        <p><button className="button button-primary button-large" disabled={busy}>{busy ? "Saving…" : isNew ? "Add New User" : self ? "Update Profile" : "Update User"}</button></p>
      </form>
      {avatarPicker && (
        <MediaModal imagesOnly title="Choose profile picture" buttonLabel="Use as profile picture" onClose={() => setAvatarPicker(false)} onSelect={(m) => { setAvatarPicker(false); if (m) set({ avatar: m.sizes?.thumbnail?.url || m.url }); }} />
      )}
    </div>
  );
}
