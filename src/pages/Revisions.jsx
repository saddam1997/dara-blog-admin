import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { get, post } from "../api.js";
import { Notice, Spinner, useNotice } from "../components/ui.jsx";
import { fmtDate } from "../utils.js";

/** Line diff (LCS) between two texts → [{type:'same'|'del'|'ins', text}] */
function diffLines(a, b) {
  const A = a.split("\n");
  const B = b.split("\n");
  const n = A.length;
  const m = B.length;
  if (n * m > 4_000_000) return [{ type: "del", text: a }, { type: "ins", text: b }];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ type: "same", text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: "del", text: A[i++] });
    else out.push({ type: "ins", text: B[j++] });
  }
  while (i < n) out.push({ type: "del", text: A[i++] });
  while (j < m) out.push({ type: "ins", text: B[j++] });
  return out;
}

const pretty = (html) => String(html || "").replace(/(<\/(p|h[1-6]|li|ul|ol|blockquote|aside|figure|tr|table|pre)>)/g, "$1\n");

export default function Revisions() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [idx, setIdx] = useState(0); // index into revisions (0 = newest revision)
  const { notice, fail, clear } = useNotice();

  useEffect(() => {
    get(`/admin/posts/${id}/revisions`).then((r) => setData(r.data)).catch(fail);
  }, [id]);

  const versions = useMemo(() => {
    if (!data) return [];
    // newest first: current, then revisions
    return [{ ...data.current, current: true, createdAt: data.current.updatedAt }, ...data.revisions];
  }, [data]);

  if (!data) return <div className="wrap"><h1 className="page-title">Revisions</h1><Notice notice={notice} /><p><Spinner /></p></div>;
  if (!data.revisions.length) return <div className="wrap"><h1 className="page-title">Revisions</h1><p>This post has no revisions yet. <Link to={`/posts/${id}`}>← Return to editor</Link></p></div>;

  const right = versions[idx];
  const left = versions[idx + 1] || { title: "", content: "", excerpt: "" };
  const rows = [
    ["Title", diffLines(left.title || "", right.title || "")],
    ["Content", diffLines(pretty(left.content), pretty(right.content))],
    ["Excerpt", diffLines(left.excerpt || "", right.excerpt || "")],
  ];

  const restore = async () => {
    try {
      await post(`/admin/posts/${id}/revisions/${right._id}/restore`);
      nav(`/posts/${id}`);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="wrap">
      <h1 className="page-title">Compare Revisions of “{data.current.title}”</h1>
      <p><Link to={`/posts/${id}`}>← Go to editor</Link></p>
      <Notice notice={notice} onClose={clear} />
      <div className="rev-slider" role="tablist" aria-label="Revisions">
        {[...versions].reverse().slice(1).map((v) => {
          const i = versions.indexOf(v);
          return (
            <button key={v._id || "current"} className={i === idx ? "on" : ""} onClick={() => setIdx(i)} role="tab" aria-selected={i === idx}>
              {v.current ? "Current" : fmtDate(v.createdAt)}
            </button>
          );
        })}
      </div>
      <div className="flex" style={{ justifyContent: "space-between", margin: "8px 0" }}>
        <span>
          <strong>From:</strong> {versions[idx + 1] ? `${fmtDate(left.createdAt)}${left.author ? ` by ${left.author.displayName}` : ""}` : "—"}
          {"   "}
          <strong>To:</strong> {right.current ? "Current version" : `${fmtDate(right.createdAt)}${right.author ? ` by ${right.author.displayName}` : ""}`}
        </span>
        {!right.current && <button className="button button-primary" onClick={restore}>Restore This Revision</button>}
      </div>
      {rows.map(([label, d]) => (
        <div key={label} style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "12px 0 6px" }}>{label}</h3>
          <div className="diff">
            <div>{d.map((x, i) => (x.type === "ins" ? null : x.type === "del" ? <del key={i}>{x.text + "\n"}</del> : <span key={i}>{x.text + "\n"}</span>))}</div>
            <div>{d.map((x, i) => (x.type === "del" ? null : x.type === "ins" ? <ins key={i}>{x.text + "\n"}</ins> : <span key={i}>{x.text + "\n"}</span>))}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
