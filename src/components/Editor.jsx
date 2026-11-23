import { useEffect, useState } from "react";
import { EditorContent, Node, mergeAttributes, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Youtube from "@tiptap/extension-youtube";
import { TableKit } from "@tiptap/extension-table";
import MediaModal from "./MediaModal.jsx";

/** DARA tip box: <aside class="dara-tip"> with any blocks inside. */
const TipBox = Node.create({
  name: "tipBox",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML: () => [{ tag: "aside.dara-tip" }, { tag: 'aside[data-type="tip"]' }],
  renderHTML: ({ HTMLAttributes }) => ["aside", mergeAttributes(HTMLAttributes, { class: "dara-tip", "data-type": "tip" }), 0],
  addCommands() {
    return {
      toggleTipBox:
        () =>
        ({ commands, editor }) =>
          editor.isActive("tipBox") ? commands.lift("tipBox") : commands.wrapIn("tipBox"),
    };
  },
});

/** Image with caption: <figure class><img><figcaption></figure> */
const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({
    src: { default: null },
    alt: { default: "" },
    caption: { default: "" },
    class: { default: "dara-image" },
  }),
  parseHTML: () => [
    {
      tag: "figure",
      getAttrs: (el) => {
        const img = el.querySelector("img");
        if (!img) return false;
        return {
          src: img.getAttribute("src"),
          alt: img.getAttribute("alt") || "",
          caption: el.querySelector("figcaption")?.textContent || "",
          class: el.getAttribute("class") || "dara-image",
        };
      },
    },
  ],
  renderHTML: ({ node }) => [
    "figure",
    { class: node.attrs.class },
    ["img", { src: node.attrs.src, alt: node.attrs.alt }],
    ...(node.attrs.caption ? [["figcaption", {}, node.attrs.caption]] : []),
  ],
});

const ImageWithClass = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), class: { default: null } };
  },
});

function Btn({ on, title, onClick, children, disabled }) {
  return (
    <button type="button" className={on ? "on" : ""} title={title} aria-label={title} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export default function Editor({ value, onChange, placeholder = "Start writing or type…" }) {
  const [mode, setMode] = useState("visual");
  const [html, setHtml] = useState(value || "");
  const [media, setMedia] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: null } } }),
      ImageWithClass,
      Figure,
      TipBox,
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: value || "",
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  // Load new content when the post finishes loading
  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== undefined && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || "", { emitUpdate: false });
      setHtml(value || "");
    }
  }, [value, editor]);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && !e.isDestroyed
        ? {
            block: e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : e.isActive("heading", { level: 4 }) ? "h4" : "p",
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            link: e.isActive("link"),
            ul: e.isActive("bulletList"),
            ol: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            code: e.isActive("codeBlock"),
            tip: e.isActive("tipBox"),
            mark: e.isActive("highlight"),
            table: e.isActive("table"),
            figure: e.isActive("figure"),
            circle: e.isActive("figure") && e.getAttributes("figure").class === "dara-image-circle",
            left: e.isActive({ textAlign: "left" }),
            center: e.isActive({ textAlign: "center" }),
            right: e.isActive({ textAlign: "right" }),
            words: e.getText().trim() ? e.getText().trim().split(/\s+/).length : 0,
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : {},
  });

  if (!editor) return null;
  const chain = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL (leave empty to remove)", prev);
    if (url === null) return;
    if (!url) return chain().extendMarkRange("link").unsetLink().run();
    const newTab = /^https?:\/\//.test(url) && !url.includes(window.location.host) && window.confirm("Open link in a new tab?");
    chain().extendMarkRange("link").setLink({ href: url, target: newTab ? "_blank" : null }).run();
  };

  const addVideo = () => {
    const url = window.prompt("YouTube video URL");
    if (url) chain().setYoutubeVideo({ src: url }).run();
  };

  const insertMedia = (m) => {
    setMedia(false);
    if (!m) return;
    if (m.mimeType && !m.mimeType.startsWith("image/")) {
      chain().insertContent(`<p><a href="${m.url}">${m.title || m.originalName || "Download file"}</a></p>`).run();
      return;
    }
    const src = m.sizes?.large?.url || m.url;
    if (m.caption) chain().insertContent({ type: "figure", attrs: { src, alt: m.alt || "", caption: m.caption } }).run();
    else chain().setImage({ src, alt: m.alt || "" }).run();
  };

  const switchMode = (next) => {
    if (next === mode) return;
    if (next === "code") setHtml(formatHtml(editor.getHTML()));
    else {
      editor.commands.setContent(html, { emitUpdate: false });
      onChange(editor.getHTML());
    }
    setMode(next);
  };

  return (
    <div className="editor-wrap">
      <div className="editor-tabs">
        <button type="button" className={mode === "visual" ? "active" : ""} onClick={() => switchMode("visual")}>Visual</button>
        <button type="button" className={mode === "code" ? "active" : ""} onClick={() => switchMode("code")}>Code</button>
      </div>

      {mode === "visual" ? (
        <>
          <div className="toolbar" role="toolbar" aria-label="Formatting">
            <select
              aria-label="Block type"
              value={s.block}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "p") chain().setParagraph().run();
                else chain().toggleHeading({ level: Number(v[1]) }).run();
              }}
            >
              <option value="p">Paragraph</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Heading 4</option>
            </select>
            <span className="sep" />
            <Btn title="Bold (Ctrl+B)" on={s.bold} onClick={() => chain().toggleBold().run()}><b>B</b></Btn>
            <Btn title="Italic (Ctrl+I)" on={s.italic} onClick={() => chain().toggleItalic().run()}><i>I</i></Btn>
            <Btn title="Underline (Ctrl+U)" on={s.underline} onClick={() => chain().toggleUnderline().run()}><u>U</u></Btn>
            <Btn title="Strikethrough" on={s.strike} onClick={() => chain().toggleStrike().run()}><s>S</s></Btn>
            <Btn title="Highlight" on={s.mark} onClick={() => chain().toggleHighlight().run()}>🖍</Btn>
            <Btn title="Insert/edit link (Ctrl+K)" on={s.link} onClick={setLink}>🔗</Btn>
            <span className="sep" />
            <Btn title="Bulleted list" on={s.ul} onClick={() => chain().toggleBulletList().run()}>• ≡</Btn>
            <Btn title="Numbered list" on={s.ol} onClick={() => chain().toggleOrderedList().run()}>1. ≡</Btn>
            <Btn title="Quote" on={s.quote} onClick={() => chain().toggleBlockquote().run()}>❝</Btn>
            <Btn title="Tip box (DARA)" on={s.tip} onClick={() => chain().toggleTipBox().run()}>💡 Tip</Btn>
            <Btn title="Code block" on={s.code} onClick={() => chain().toggleCodeBlock().run()}>{"</>"}</Btn>
            <span className="sep" />
            <Btn title="Align left" on={s.left} onClick={() => chain().setTextAlign("left").run()}>⇤</Btn>
            <Btn title="Align center" on={s.center} onClick={() => chain().setTextAlign("center").run()}>↔</Btn>
            <Btn title="Align right" on={s.right} onClick={() => chain().setTextAlign("right").run()}>⇥</Btn>
            <span className="sep" />
            <Btn title="Add media" onClick={() => setMedia(true)}>🖼 Add Media</Btn>
            {s.figure && (
              <Btn
                title="Toggle circular image"
                on={s.circle}
                onClick={() => chain().updateAttributes("figure", { class: s.circle ? "dara-image" : "dara-image-circle" }).run()}
              >
                ◯
              </Btn>
            )}
            <Btn title="Embed YouTube video" onClick={addVideo}>▶</Btn>
            <Btn title="Insert table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦</Btn>
            {s.table && (
              <>
                <Btn title="Add row" onClick={() => chain().addRowAfter().run()}>+row</Btn>
                <Btn title="Add column" onClick={() => chain().addColumnAfter().run()}>+col</Btn>
                <Btn title="Delete row" onClick={() => chain().deleteRow().run()}>−row</Btn>
                <Btn title="Delete column" onClick={() => chain().deleteColumn().run()}>−col</Btn>
                <Btn title="Delete table" onClick={() => chain().deleteTable().run()}>✕▦</Btn>
              </>
            )}
            <Btn title="Horizontal line" onClick={() => chain().setHorizontalRule().run()}>―</Btn>
            <span className="sep" />
            <Btn title="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>⌫</Btn>
            <Btn title="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={() => chain().undo().run()}>↶</Btn>
            <Btn title="Redo (Ctrl+Y)" disabled={!s.canRedo} onClick={() => chain().redo().run()}>↷</Btn>
          </div>
          <EditorContent editor={editor} />
        </>
      ) : (
        <textarea
          className="html-editor"
          aria-label="HTML code"
          value={html}
          onChange={(e) => {
            setHtml(e.target.value);
            onChange(e.target.value);
          }}
        />
      )}
      <div className="editor-status">
        <span>Word count: {mode === "visual" ? s.words : html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length}</span>
        <span>{mode === "code" ? "Editing HTML" : ""}</span>
      </div>
      {media && <MediaModal title="Add Media" buttonLabel="Insert into post" onSelect={insertMedia} onClose={() => setMedia(false)} />}
    </div>
  );
}

/** Put block tags on their own lines so the Code view is readable. */
function formatHtml(html) {
  return html.replace(/(<\/(p|h[1-6]|ul|ol|li|blockquote|aside|figure|table|thead|tbody|tr|pre|div)>|<hr>|<br>)(?!\n)/g, "$1\n");
}
