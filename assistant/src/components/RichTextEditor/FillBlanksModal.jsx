import React, { useRef, useCallback, useEffect } from "react";
import { FiX, FiCheck, FiFileText } from "react-icons/fi";
import "./FillBlanksModal.css";

/**
 * Matches sequences of 3+ dots (ASCII or Unicode ellipsis) used as blank
 * placeholders in medical form templates, e.g. "Образование: ……………"
 */
const BLANK_RE = /([.…·]{3,})/g;

/** Matches the custom <span data-tpl-blank> nodes inserted from the toolbar */
const TPL_BLANK_RE = /<span[^>]*data-tpl-blank[^>]*>.*?<\/span>/gi;

/** Returns true if the HTML string contains at least one blank placeholder */
export const hasBlank = (html) => {
  if (!html) return false;
  TPL_BLANK_RE.lastIndex = 0;
  if (TPL_BLANK_RE.test(html)) return true;
  BLANK_RE.lastIndex = 0;
  return BLANK_RE.test(html);
};

/**
 * FillBlanksModal
 *
 * Props:
 *   template  – { name, content }  (the selected template)
 *   onInsert(html)  – called with the final HTML (filled or raw)
 *   onClose()       – called to dismiss without inserting
 */
const FillBlanksModal = ({ template, onInsert, onClose }) => {
  const bodyRef = useRef(null);

  /* ── Inject template HTML with inline <input> fields at every blank ── */
  useEffect(() => {
    if (!bodyRef.current || !template) return;

    let idx = 0;

    const makeInput = (width) =>
      `<input type="text" class="fbm-blank" data-idx="${idx++}" style="width:${width}ch" autocomplete="off" spellcheck="false" />`;

    /* Step 1 — replace custom <span data-tpl-blank> nodes (fixed 16ch width) */
    const step1 = template.content.replace(
      /<span[^>]*data-tpl-blank[^>]*>.*?<\/span>/gi,
      () => makeInput(16)
    );

    /* Step 2 — replace dot sequences, scaling width to dot length */
    const html = step1.replace(/([.…·]{3,})/g, (dots) => {
      const w = Math.max(5, Math.min(Math.round(dots.length * 0.85), 40));
      return makeInput(w);
    });

    bodyRef.current.innerHTML = html;

    /* Auto-focus first blank */
    const blanks = Array.from(bodyRef.current.querySelectorAll(".fbm-blank"));
    blanks[0]?.focus();
    blanks.forEach((inp, i) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          blanks[i + 1]?.focus();
        }
      });
    });
  }, [template]);

  /* ── Collect values from DOM inputs and rebuild HTML ── */
  const handleInsert = useCallback(() => {
    if (!bodyRef.current || !template) return;
    const inputs = bodyRef.current.querySelectorAll(".fbm-blank");
    let idx = 0;

    /* Mirrors the injection order: custom spans first, then dots */
    const step1 = template.content.replace(
      /<span[^>]*data-tpl-blank[^>]*>.*?<\/span>/gi,
      () => {
        const val = inputs[idx++]?.value?.trim();
        /* If filled: plain text; if left empty: keep the blank span */
        return val
          ? val
          : '<span data-tpl-blank="true" class="tpl-blank">________</span>';
      }
    );

    const result = step1.replace(/([.…·]{3,})/g, (originalDots) => {
      const val = inputs[idx++]?.value?.trim();
      return val || originalDots;
    });

    onInsert(result);
  }, [template, onInsert]);

  /* Insert the template exactly as-is (no filling) */
  const handleInsertRaw = useCallback(() => {
    onInsert(template.content);
  }, [template, onInsert]);

  if (!template) return null;

  return (
    <div className="fbm-overlay" onMouseDown={onClose}>
      <div className="fbm-panel" onMouseDown={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="fbm-head">
          <div className="fbm-head-left">
            <FiFileText size={14} className="fbm-head-icon" />
            <span className="fbm-head-name">{template.name}</span>
          </div>
          <button className="fbm-close" onClick={onClose} title="Close">
            <FiX size={13} />
          </button>
        </div>

        {/* ── Hint ── */}
        <div className="fbm-hint">
          Click each blank field and type to fill it in. Press <kbd>Enter</kbd> or <kbd>Tab</kbd> to jump to the next.
        </div>

        {/* ── Template body with injected inputs ── */}
        <div className="fbm-body" ref={bodyRef} />

        {/* ── Footer ── */}
        <div className="fbm-foot">
          <button className="fbm-btn fbm-btn--ghost" onClick={handleInsertRaw}>
            Insert without filling
          </button>
          <div className="fbm-foot-spacer" />
          <button className="fbm-btn fbm-btn--cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="fbm-btn fbm-btn--ok" onClick={handleInsert}>
            <FiCheck size={13} />
            Insert
          </button>
        </div>
      </div>
    </div>
  );
};

export default FillBlanksModal;
