import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import "./RichTextEditor.css";

/* ─── Preset colors ─── */
const COLOR_PRESETS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#efefef", "#ffffff",
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#9b59b6",
  "#c0392b", "#d35400", "#f39c12", "#27ae60", "#16a085", "#2980b9", "#8e44ad",
];

/* ═══════════════════════════════════════════════════════════
   Toolbar
   ═══════════════════════════════════════════════════════════ */
const CommonToolbar = ({ editor }) => {
  const { t } = useTranslation("rich_text_editor");
  const [showSource, setShowSource] = useState(false);
  const [sourceHtml, setSourceHtml] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const colorRef = useRef(null);
  const bgColorRef = useRef(null);

  /* close color pickers on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (colorRef.current && !colorRef.current.contains(e.target))
        setShowColorPicker(false);
      if (bgColorRef.current && !bgColorRef.current.contains(e.target))
        setShowBgColorPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!editor) return null;

  /* Source toggle */
  const toggleSource = () => {
    if (!showSource) {
      setSourceHtml(editor.getHTML());
      setShowSource(true);
    } else {
      editor.commands.setContent(sourceHtml);
      setShowSource(false);
    }
  };

  const btn = (active, onClick, children, title) => (
    <button
      type="button"
      className={`rte-btn${active ? " rte-btn--active" : ""}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );

  const sep = () => <span className="rte-sep" />;

  return (
    <div className="rte-toolbar">
      {/* Source */}
      {btn(showSource, toggleSource, <span className="rte-icon">&lt;&gt;</span>, t("html"))}
      {sep()}

      {/* Undo / Redo */}
      {btn(false, () => editor.chain().focus().undo().run(), <span className="rte-icon">↩</span>, t("undo"))}
      {btn(false, () => editor.chain().focus().redo().run(), <span className="rte-icon">↪</span>, t("redo"))}
      {sep()}

      {/* Heading dropdown */}
      <select
        className="rte-select"
        value={
          editor.isActive("heading", { level: 1 }) ? 1 :
          editor.isActive("heading", { level: 2 }) ? 2 :
          editor.isActive("heading", { level: 3 }) ? 3 :
          editor.isActive("heading", { level: 4 }) ? 4 : 0
        }
        onChange={(e) => {
          const val = Number(e.target.value);
          if (val === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: val }).run();
        }}
      >
        <option value={0}>{t("heading_normal")}</option>
        <option value={1}>{t("heading_1")}</option>
        <option value={2}>{t("heading_2")}</option>
        <option value={3}>{t("heading_3")}</option>
        <option value={4}>{t("heading_4")}</option>
      </select>
      {sep()}

      {/* Bold / Italic / Underline / Strikethrough */}
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <b>B</b>, t("bold"))}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <i>I</i>, t("italic"))}
      {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), <u>U</u>, t("underline"))}
      {btn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), <s>S</s>, t("strikethrough"))}
      {btn(editor.isActive("subscript"), () => editor.chain().focus().toggleSubscript().run(), <span>X<sub>₂</sub></span>, t("subscript"))}
      {btn(editor.isActive("superscript"), () => editor.chain().focus().toggleSuperscript().run(), <span>X<sup>²</sup></span>, t("superscript"))}
      {sep()}

      {/* Link */}
      {btn(editor.isActive("link"), () => {
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
        } else {
          const url = prompt(t("link_prompt"));
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }
      }, <span className="rte-icon">🔗</span>, t("link"))}
      {sep()}

      {/* Alignment */}
      {btn(editor.isActive({ textAlign: "left" }), () => editor.chain().focus().setTextAlign("left").run(), <span className="rte-icon">≡ₗ</span>, t("align_left"))}
      {btn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), <span className="rte-icon">≡ᶜ</span>, t("align_center"))}
      {btn(editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run(), <span className="rte-icon">≡ᵣ</span>, t("align_right"))}
      {btn(editor.isActive({ textAlign: "justify" }), () => editor.chain().focus().setTextAlign("justify").run(), <span className="rte-icon">≡ⱼ</span>, t("align_justify"))}
      {sep()}

      {/* Lists */}
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <span className="rte-icon">•≡</span>, t("bullet_list"))}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <span className="rte-icon">1≡</span>, t("ordered_list"))}
      {sep()}

      {/* Remove formatting */}
      {btn(false, () => editor.chain().focus().clearNodes().unsetAllMarks().run(), <span className="rte-icon">T<sub>x</sub></span>, t("clear_formatting"))}
      {sep()}

      {/* Font family */}
      <select
        className="rte-select rte-select--font"
        value={editor.getAttributes("textStyle").fontFamily || ""}
        onChange={(e) => {
          const val = e.target.value;
          if (val) editor.chain().focus().setFontFamily(val).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
      >
        <option value="">{t("font_default")}</option>
        <option value="Arial" style={{ fontFamily: "Arial" }}>Arial</option>
        <option value="Times New Roman" style={{ fontFamily: "Times New Roman" }}>Times New Roman</option>
        <option value="Courier New" style={{ fontFamily: "Courier New" }}>Courier New</option>
        <option value="Georgia" style={{ fontFamily: "Georgia" }}>Georgia</option>
        <option value="Verdana" style={{ fontFamily: "Verdana" }}>Verdana</option>
        <option value="Tahoma" style={{ fontFamily: "Tahoma" }}>Tahoma</option>
        <option value="Trebuchet MS" style={{ fontFamily: "Trebuchet MS" }}>Trebuchet MS</option>
      </select>
      {sep()}

      {/* Font color */}
      <div className="rte-color-wrap" ref={colorRef}>
        <button
          type="button"
          className="rte-btn rte-color-btn"
          onClick={() => setShowColorPicker(!showColorPicker)}
          title={t("font_color")}
        >
          <span className="rte-color-letter" style={{ borderBottomColor: editor.getAttributes("textStyle").color || "#000" }}>A</span>
        </button>
        {showColorPicker && (
          <div className="rte-color-dropdown">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className="rte-color-swatch"
                style={{ background: c }}
                onClick={() => {
                  editor.chain().focus().setColor(c).run();
                  setShowColorPicker(false);
                }}
              />
            ))}
            <button
              type="button"
              className="rte-color-reset"
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setShowColorPicker(false);
              }}
            >
              {t("color_reset")}
            </button>
          </div>
        )}
      </div>

      {/* Background highlight color */}
      <div className="rte-color-wrap" ref={bgColorRef}>
        <button
          type="button"
          className="rte-btn rte-color-btn"
          onClick={() => setShowBgColorPicker(!showBgColorPicker)}
          title={t("bg_color")}
        >
          <span className="rte-color-letter rte-color-letter--bg" style={{ backgroundColor: editor.getAttributes("highlight").color || "transparent" }}>A</span>
        </button>
        {showBgColorPicker && (
          <div className="rte-color-dropdown">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className="rte-color-swatch"
                style={{ background: c }}
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color: c }).run();
                  setShowBgColorPicker(false);
                }}
              />
            ))}
            <button
              type="button"
              className="rte-color-reset"
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setShowBgColorPicker(false);
              }}
            >
              {t("color_reset")}
            </button>
          </div>
        )}
      </div>
      {sep()}

      {/* Table */}
      {btn(false, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), <span className="rte-icon">⊞</span>, t("insert_table"))}

      {/* Table controls — only visible when cursor is inside a table */}
      {editor.isActive("table") && (
        <>
          {btn(false, () => editor.chain().focus().addColumnBefore().run(), <span className="rte-icon">⫷</span>, t("column_before"))}
          {btn(false, () => editor.chain().focus().addColumnAfter().run(), <span className="rte-icon">⫸</span>, t("column_after"))}
          {btn(false, () => editor.chain().focus().deleteColumn().run(), <span className="rte-icon rte-icon--danger">⊘c</span>, t("delete_column"))}
          {btn(false, () => editor.chain().focus().addRowBefore().run(), <span className="rte-icon">⤒</span>, t("row_before"))}
          {btn(false, () => editor.chain().focus().addRowAfter().run(), <span className="rte-icon">⤓</span>, t("row_after"))}
          {btn(false, () => editor.chain().focus().deleteRow().run(), <span className="rte-icon rte-icon--danger">⊘r</span>, t("delete_row"))}
          {btn(false, () => editor.chain().focus().deleteTable().run(), <span className="rte-icon rte-icon--danger">✕⊞</span>, t("delete_table"))}
        </>
      )}

      {/* Indent / Outdent via blockquote */}
      {btn(false, () => editor.chain().focus().sinkListItem("listItem").run(), <span className="rte-icon">→⇥</span>, t("indent"))}
      {btn(false, () => editor.chain().focus().liftListItem("listItem").run(), <span className="rte-icon">⇤←</span>, t("outdent"))}

      {/* Source editor overlay */}
      {showSource && (
        <div className="rte-source-overlay">
          <textarea
            className="rte-source-textarea"
            value={sourceHtml}
            onChange={(e) => setSourceHtml(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   CommonRichTextEditor — main export
   ═══════════════════════════════════════════════════════════ */
const CommonRichTextEditor = ({ value = "", onChange, placeholder = "Введите текст…" }) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => {
      onChangeRef.current?.(ed.getHTML());
    },
  });

  const prevValue = useRef(value);
  useEffect(() => {
    if (!editor) return;
    if (value === prevValue.current) return;
    prevValue.current = value;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value || "", false, { preserveWhitespace: "full" });
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="rte-container">
        <div className="rte-toolbar" />
        <div className="rte-content" style={{ minHeight: 120 }} />
      </div>
    );
  }

  return (
    <div className="rte-container">
      <CommonToolbar editor={editor} />
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
};

export default CommonRichTextEditor;
