import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";

/**
 * TemplateBlankExtension
 *
 * Inserts an inline atomic node rendered as a dashed blank pill.
 * Clicking the blank removes it and places the cursor at that position.
 */
const TemplateBlankExtension = Node.create({
  name: "templateBlank",
  group: "inline",
  inline: true,
  atom: true,

  parseHTML() {
    return [{ tag: "span[data-tpl-blank]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-tpl-blank": "true",
        class: "tpl-blank",
      }),
      "________",
    ];
  },

  addNodeView() {
    return () => {
      const dom = document.createElement("span");
      dom.setAttribute("data-tpl-blank", "true");
      dom.className = "tpl-blank";
      dom.textContent = "________";
      return { dom };
    };
  },

  /* ── Use a ProseMirror plugin — the only reliable way to catch clicks
        on atom nodes (ProseMirror consumes the event before the DOM handler) ── */
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleClickOn(view, _pos, node, nodePos) {
            if (node.type.name !== "templateBlank") return false;

            const { tr, doc } = view.state;
            // Delete the blank node
            tr.delete(nodePos, nodePos + node.nodeSize);
            // Place the cursor exactly where the blank was
            const sel = TextSelection.create(tr.doc, Math.min(nodePos, tr.doc.content.size));
            tr.setSelection(sel);
            view.dispatch(tr);
            view.focus();
            return true;   // event handled — stop propagation
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      insertTemplateBlank:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

export default TemplateBlankExtension;
