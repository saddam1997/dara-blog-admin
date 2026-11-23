import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { SITE_URL } from "../api.js";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ login: "", password: "", remember: true });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(form.login, form.password, form.remember);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="logo-big" aria-hidden="true">D</div>
      {error && (
        <div className="notice notice-error" style={{ width: 320 }} role="alert">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}
      <form onSubmit={submit}>
        <label htmlFor="user_login">Username or Email Address</label>
        <input id="user_login" type="text" autoComplete="username" required autoFocus value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        <label htmlFor="user_pass">Password</label>
        <div style={{ position: "relative" }}>
          <input id="user_pass" type={show ? "text" : "password"} autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button type="button" className="button-link" onClick={() => setShow(!show)} style={{ position: "absolute", right: 8, top: 10, textDecoration: "none" }} aria-label={show ? "Hide password" : "Show password"}>
            {show ? "🙈" : "👁"}
          </button>
        </div>
        <div className="row">
          <label>
            <input type="checkbox" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} /> Remember Me
          </label>
          <button className="button button-primary button-large" disabled={busy}>{busy ? "Logging in…" : "Log In"}</button>
        </div>
      </form>
      <a className="back" href={`${SITE_URL}/blog`}>← Go to DARA Blog</a>
    </div>
  );
}
