import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { get, SITE_URL } from "../api.js";

const MENU = [
  { label: "Dashboard", icon: "⌂", to: "/", cap: "edit_posts", exact: true, sub: [{ label: "Home", to: "/" }, { label: "Activity Log", to: "/activity", cap: "view_activity" }] },
  { sep: true },
  {
    label: "Posts",
    icon: "✎",
    to: "/posts",
    cap: "edit_posts",
    badge: "pendingPosts",
    sub: [
      { label: "All Posts", to: "/posts" },
      { label: "Add New Post", to: "/posts/new" },
      { label: "Categories", to: "/categories", cap: "manage_categories" },
      { label: "Tags", to: "/tags" },
    ],
  },
  { label: "Media", icon: "▣", to: "/media", cap: "upload_files", sub: [{ label: "Library", to: "/media" }, { label: "Add New Media File", to: "/media/new" }] },
  { label: "Comments", icon: "✉", to: "/comments", cap: "edit_posts", badge: "pendingComments" },
  {
    label: "Newsletter",
    icon: "✦",
    to: "/newsletter",
    cap: "manage_newsletter",
    sub: [
      { label: "Subscribers", to: "/newsletter" },
      { label: "Notifications", to: "/newsletter/campaigns" },
    ],
  },
  { sep: true },
  {
    label: "Users",
    icon: "☺",
    to: "/users",
    cap: "read",
    sub: [
      { label: "All Users", to: "/users", cap: "list_users" },
      { label: "Add New User", to: "/users/new", cap: "create_users" },
      { label: "Profile", to: "/profile" },
    ],
  },
  { label: "Tools", icon: "⚒", to: "/tools", cap: "manage_options" },
  {
    label: "Settings",
    icon: "⚙",
    to: "/settings/general",
    match: "/settings",
    cap: "manage_options",
    sub: [
      { label: "General", to: "/settings/general" },
      { label: "Reading", to: "/settings/reading" },
      { label: "Discussion", to: "/settings/discussion" },
      { label: "Media", to: "/settings/media" },
    ],
  },
];

export default function Layout() {
  const { user, can, logout } = useAuth();
  const { pathname } = useLocation();
  const [badges, setBadges] = useState({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    get("/admin/badges").then((r) => setBadges(r.data)).catch(() => {});
    setOpen(false);
  }, [pathname]);

  const isCurrent = (item) => {
    const base = item.match || item.to;
    if (item.exact) return pathname === "/" || pathname === "/activity";
    return pathname.startsWith(base) || (item.sub || []).some((s) => pathname.startsWith(s.to) && s.to !== "/");
  };

  return (
    <>
      <div className="adminbar">
        
        <div className="flex" style={{ gap: 0 }}>
          <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <Link to="/" title="Dashboard" className="logo-link"><span className="logo"><img src={`${import.meta.env.BASE_URL}dara-logo.svg`} alt="DARA" /></span></Link>
          <a href={`${SITE_URL}/blog`} target="_blank" rel="noreferrer">🏠 DARA Blog</a>
          {badges.pendingComments > 0 && <Link to="/comments?status=pending">💬 {badges.pendingComments}</Link>}
          {can("edit_posts") && <Link to="/posts/new">＋ New</Link>}
        </div>
        <div className="flex" style={{ gap: 0 }}>
          <Link to="/profile">
            Howdy, {user?.displayName} <span className="avatar">{user?.displayName?.[0]?.toUpperCase()}</span>
          </Link>
          <button onClick={logout}>Log Out</button>
        </div>
      </div>
      <nav className={`sidebar ${open ? "open" : ""}`} aria-label="Main menu">
        <ul>
          {MENU.map((item, i) => {
            if (item.sep) return <li key={i} className="sep" />;
            if (item.cap && !can(item.cap)) return null;
            const current = isCurrent(item);
            const subs = (item.sub || []).filter((s) => !s.cap || can(s.cap));
            const badge = item.badge ? badges[item.badge] : 0;
            return (
              <li key={item.label} className={`menu-item ${current ? "current" : ""}`}>
                <Link to={subs[0]?.to || item.to}>
                  <span className="icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                  {badge > 0 && <span className="count">{badge}</span>}
                </Link>
                {current && subs.length > 0 && (
                  <ul className="submenu">
                    {subs.map((s) => (
                      <li key={s.to}>
                        <NavLink to={s.to} end className={({ isActive }) => (isActive ? "active" : "")}>
                          {s.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="content">
        <Outlet context={{ refreshBadges: () => get("/admin/badges").then((r) => setBadges(r.data)).catch(() => {}) }} />
      </main>
    </>
  );
}
