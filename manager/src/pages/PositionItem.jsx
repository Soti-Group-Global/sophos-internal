import React from "react";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * PositionItem — single file/position row in the Service Manager table.
 *
 * Props:
 *   position   {object}   the position document
 *   onEdit     {fn}       called with the position object to open the edit modal
 *   onDelete   {fn}       called with the position _id to delete it
 */
const PositionItem = ({ position, onEdit, onDelete }) => {
  const { t } = useTranslation("serviceManager");

  const formatPrice = (val) => {
    if (val === undefined || val === null || val === "") return "—";
    const num = Number(val);
    if (isNaN(num)) return "—";
    return `₽ ${num.toLocaleString("ru-RU")}`;
  };

  return (
    <tr>
      <td>
        <div className="sm-name-cell">
          <FileText size={16} className="sm-file-icon" />
          <span className="sm-name-text">{position.name}</span>
        </div>
      </td>
      <td className="sm-price-cell">{formatPrice(position.price)}</td>
      <td>
        <div className="sm-actions-cell">
          <button
            className="sm-icon-btn edit"
            title={t("position.edit")}
            onClick={() => onEdit(position)}
          >
            <Pencil size={14} />
          </button>
          <button
            className="sm-icon-btn delete"
            title={t("position.delete")}
            onClick={() => onDelete(position._id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default PositionItem;
