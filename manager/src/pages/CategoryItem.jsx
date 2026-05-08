import React from "react";
import { Folder, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * CategoryItem — single folder row in the Service Manager table.
 *
 * Props:
 *   category   {object}   the category document
 *   onOpen     {fn}       called when the user clicks the folder name to navigate into it
 *   onEdit     {fn}       called with the category object to open the edit modal
 *   onDelete   {fn}       called with the category _id to delete it
 */
const CategoryItem = ({ category, onOpen, onEdit, onDelete }) => {
  const { t } = useTranslation("serviceManager");

  return (
    <tr>
      <td>
        <div
          className="sm-name-cell folder"
          onClick={() => onOpen(category)}
          title={t("category.open", { name: category.name })}
        >
          <Folder size={18} className="sm-folder-icon" />
          <span className="sm-name-text">{category.name}</span>
        </div>
      </td>
      <td className="sm-price-cell">—</td>
      <td>
        <div className="sm-actions-cell">
          <button
            className="sm-icon-btn edit"
            title={t("category.edit")}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(category);
            }}
          >
            <Pencil size={14} />
          </button>
          <button
            className="sm-icon-btn delete"
            title={t("category.delete")}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(category._id);
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default CategoryItem;
