export const fmtDate = (d, withTime = true) => {
  if (!d) return "—";
  const date = new Date(d);
  const day = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return withTime ? `${day} at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : day;
};

export const timeAgo = (d) => {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["min", 60]];
  for (const [u, n] of units) if (s >= n) return `${Math.floor(s / n)} ${u}${Math.floor(s / n) > 1 ? "s" : ""} ago`;
  return "";
};

/** <input type="datetime-local"> value from a Date */
export const toLocalInput = (d) => {
  if (!d) return "";
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 16);
};

export const STATUS_LABEL = { publish: "Published", draft: "Draft", pending: "Pending", future: "Scheduled", private: "Private", trash: "Trash" };

export const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export const stripTags = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 190);

export const fileSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round((b || 0) / 1024)} KB`);

export const ROLE_LABEL = { administrator: "Administrator", editor: "Editor", author: "Author", contributor: "Contributor", subscriber: "Subscriber" };
