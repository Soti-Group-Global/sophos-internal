import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./ConfirmDialog.css";

const ConfirmDialog = ({
  open,
  title = "Подтвердите действие",
  message,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  onConfirm,
  onCancel,
  danger = true,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="cd-overlay" onClick={onCancel}>
      <div className="cd-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="cd-header">
          <span className="cd-title">{title}</span>
        </div>
        <div className="cd-body">
          <p className="cd-message">{message}</p>
        </div>
        <div className="cd-footer">
          <button className="cd-btn cd-btn--cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`cd-btn ${danger ? "cd-btn--danger" : "cd-btn--confirm"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
