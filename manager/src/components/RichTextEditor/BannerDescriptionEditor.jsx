import React, { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";

/* ─── Custom FontSize extension built on TextStyle ─── */
const FontSizeExtension = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize || null,
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

const FONT_SIZES = ["19.2px", "14.4px", "12.8px"];

/* ─── BannerDescriptionEditor ─── */
const BannerDescriptionEditor = ({
  value = "",
  onChange,
  placeholder = "Enter text…",
  hideToolbar = false,
}) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      TextStyle,
      FontSizeExtension,
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
    editor.commands.setContent(value || "", false, {
      preserveWhitespace: "full",
    });
  }, [value, editor]);

  if (!editor) return null;

  const currentFontSize = editor.getAttributes("textStyle").fontSize || "";

  return (
    <div className="bde-container">
      {!hideToolbar && (
      <div className="bde-toolbar">
        {/* Bold */}
        <button
          type="button"
          className={`bde-btn${editor.isActive("bold") ? " bde-btn--active" : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <b>B</b>
        </button>

        <span className="bde-sep" />

        {/* Font size buttons */}
        {FONT_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            className={`bde-btn bde-size-btn${currentFontSize === size ? " bde-btn--active" : ""}`}
            onClick={() =>
              currentFontSize === size
                ? editor.chain().focus().unsetFontSize().run()
                : editor.chain().focus().setFontSize(size).run()
            }
            title={`Font size ${size}`}
          >
            {size}
          </button>
        ))}
      </div>
      )}

      <EditorContent editor={editor} className="bde-content" />
    </div>
  );
};

export default BannerDescriptionEditor;
