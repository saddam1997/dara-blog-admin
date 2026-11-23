import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, session } from "./api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => session.get());

  useEffect(() => {
    const onLogout = () => setState(null);
    window.addEventListener("dara:logout", onLogout);
    return () => window.removeEventListener("dara:logout", onLogout);
  }, []);

  // Refresh user + capabilities on load
  useEffect(() => {
    if (!session.get()) return;
    api("/auth/me")
      .then((r) => {
        session.update({ user: r.data.user, capabilities: r.data.capabilities });
        setState(session.get());
      })
      .catch(() => {});
  }, []);

  const login = useCallback(async (loginId, password, remember) => {
    const r = await api("/auth/login", { method: "POST", body: { login: loginId, password } });
    session.set(r.data, remember);
    setState(r.data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
    } catch {
      /* ignore */
    }
    session.clear();
    setState(null);
  }, []);

  const setUser = useCallback((user) => {
    session.update({ user });
    setState(session.get());
  }, []);

  const can = useCallback((cap) => Boolean(state?.capabilities?.includes(cap)), [state]);

  return <AuthCtx.Provider value={{ user: state?.user, can, login, logout, setUser }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
