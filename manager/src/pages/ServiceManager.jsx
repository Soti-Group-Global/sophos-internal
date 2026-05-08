import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, FileSpreadsheet, FolderOpen, Plus, Upload, X } from "lucide-react";
import Papa from "papaparse";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  getAllCategories,
  getServiceCategoryFolderContents,
  deleteServiceCategory,
  deleteServicePosition,
  createServicePosition,
  exportServiceCategories,
  importServiceCategories,
} from "../utils/api";
import CategoryItem from "./CategoryItem";
import PositionItem from "./PositionItem";
import CategoryModal from "./CategoryModal";
import PositionModal from "./PositionModal";
import "../styles/ServiceManager.css";

const ServiceManager = () => {
  const { t } = useTranslation("serviceManager");

  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [categories, setCategories] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const openedCategoryRef = useRef(null);
  const consultationAutoCreatedRef = useRef(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [categoryTree, setCategoryTree] = useState([]);
  const [selectedExportCategories, setSelectedExportCategories] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importErrors, setImportErrors] = useState([]);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importing, setImporting] = useState(false);

  const loadFolder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getServiceCategoryFolderContents({ parent: currentFolder || "root" });
      const fetchedCategories = Array.isArray(data.categories) ? data.categories : [];
      let fetchedPositions = Array.isArray(data.positions) ? data.positions : [];
      setCategories(fetchedCategories);
      setPositions(fetchedPositions);

      // Auto-create "Консультация" once per folder navigation (not on every refresh)
      const cat = openedCategoryRef.current;
      if (cat?.isLinkedWithSpeciality && !consultationAutoCreatedRef.current && !fetchedPositions.some(p => p.name === "Консультация")) {
        consultationAutoCreatedRef.current = true;
        try {
          await createServicePosition({
            name: "Консультация",
            category: cat._id,
            isActive: true,
            type: "service",
            price: 0,
            isConsultation: true,
          });
          const refreshed = await getServiceCategoryFolderContents({ parent: currentFolder || "root" });
          fetchedPositions = Array.isArray(refreshed.positions) ? refreshed.positions : [];
          setPositions(fetchedPositions);
        } catch { /* non-critical */ }
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [currentFolder, t]);

  useEffect(() => { loadFolder(); }, [loadFolder]);

  const loadCategoryTree = useCallback(async () => {
    try {
      const data = await getAllCategories({ flat: "true" });
      const allCategories = Array.isArray(data.categories) ? data.categories : [];
      const byParent = new Map();
      allCategories.forEach((category) => {
        const parentKey = category.parent ? category.parent.toString() : "root";
        if (!byParent.has(parentKey)) byParent.set(parentKey, []);
        byParent.get(parentKey).push(category);
      });

      const build = (parentKey = "root") =>
        (byParent.get(parentKey) || []).map((category) => ({
          ...category,
          children: build(category._id.toString()),
        }));

      setCategoryTree(build());
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load categories");
    }
  }, []);

  useEffect(() => {
    if (showExportModal) loadCategoryTree();
  }, [showExportModal, loadCategoryTree]);

  const openFolder = (category) => {
    openedCategoryRef.current = category;
    consultationAutoCreatedRef.current = false;
    setBreadcrumb((prev) => [...prev, { _id: category._id, name: category.name }]);
    setCurrentFolder(category._id);
  };

  const navigateTo = (index) => {
    openedCategoryRef.current = null;
    if (index < 0) {
      setBreadcrumb([]);
      setCurrentFolder(null);
    } else {
      const segment = breadcrumb[index];
      setBreadcrumb((prev) => prev.slice(0, index + 1));
      setCurrentFolder(segment?._id || null);
    }
  };

  const handleAddCategory = () => { setEditingCategory(null); setShowCategoryModal(true); };
  const handleEditCategory = (cat) => { setEditingCategory(cat); setShowCategoryModal(true); };
  const handleDeleteCategory = async (id) => {
    if (!window.confirm(t("confirmDeleteCategory"))) return;
    try {
      await deleteServiceCategory(id);
      toast.success(t("categoryDeleted"));
      loadFolder();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("errors.deleteFailed"));
    }
  };

  const handleAddPosition = () => { setEditingPosition(null); setShowPositionModal(true); };
  const handleEditPosition = (pos) => { setEditingPosition(pos); setShowPositionModal(true); };
  const handleDeletePosition = async (id) => {
    if (!window.confirm(t("confirmDeletePosition"))) return;
    try {
      await deleteServicePosition(id);
      toast.success(t("positionDeleted"));
      loadFolder();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("errors.deleteFailed"));
    }
  };

  const collectCategoryIds = (nodes) =>
    nodes.flatMap((node) => [node._id, ...collectCategoryIds(node.children || [])]);

  const toggleExportCategory = (category) => {
    const ids = collectCategoryIds([category]);
    setSelectedExportCategories((prev) => {
      const selected = ids.every((id) => prev.includes(id));
      return selected
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])];
    });
  };

  const handleSelectAllExport = () => {
    const ids = collectCategoryIds(categoryTree);
    setSelectedExportCategories((prev) => (prev.length === ids.length ? [] : ids));
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportServiceCategories({
        categories: selectedExportCategories.join(","),
      });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `services-export-${date}.csv`);
      toast.success(t("export.downloaded"));
      setShowExportModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || t("export.failed"));
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = () => {
    const rows = [
      ["Код", "Код НМУ", "Наименование", "Стоимость", "Описание"],
      ["1", "", "Лаборатория КДЛ", "", ""],
      ["1.1", "", "АЛЛЕРГОЛОГИЯ", "", ""],
      ["1.1.1", "", "Диагностика пищевой непереносимости", "", ""],
      ["17.17.A10", "A09.05.118.227", "FOX (Food Xplorer) IgG, 287 антигенов", "117060,00", "КДЛ: Биоматериал - сыворотка | Контейнер - ГЖК | Срок - 1 дн."],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "services-import-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const _normalizeImportRow = (row) => ({
    code: row.Code || row.code || row["Код"] || "",
    pmuCode: row["PMU Code"] || row.pmuCode || row["Код ММУ"] || row["Код МУ"] || "",
    name: row.Name || row.name || row["Наименование"] || "",
    price: row.Price || row.price || row["Стоимость"] || "",
    description: row.Description || row.description || row["Описание"] || "",
    categoryName: row.Category || row.category || row["Категория"] || "",
  });

  const normalizeHeader = (value) =>
    String(value || "").replace(/^\uFEFF/, "").trim().toLowerCase();

  const getImportColumn = (header) => {
    const normalized = normalizeHeader(header);
    if (["id", "ид"].includes(normalized)) return "ignore";
    if (["код", "code"].includes(normalized)) return "code";
    if (["код нму", "код мму", "код пму", "pmu code", "pmucode"].includes(normalized)) return "pmuCode";
    if (["наименование", "name"].includes(normalized)) return "name";
    if (["стоимость", "price"].includes(normalized)) return "price";
    if (["описание", "description"].includes(normalized)) return "description";
    return null;
  };

  const chooseImportParse = (text) => {
    const candidates = [";", "\t", ","].map((delimiter) => {
      const result = Papa.parse(text, { delimiter, skipEmptyLines: "greedy" });
      const rows = result.data || [];
      const header = rows[0] || [];
      const columns = header.map(getImportColumn);
      const knownColumns = columns.filter((column) => column && column !== "ignore").length;
      const rowShapeErrors = rows.slice(1).filter((row) => !isImportRowShapeAllowed(row, delimiter, columns)).length;
      return { delimiter, result, rows, knownColumns, rowShapeErrors };
    });

    return candidates.sort((a, b) =>
      b.knownColumns - a.knownColumns || a.rowShapeErrors - b.rowShapeErrors
    )[0];
  };

  const trimTrailingEmptyCells = (row) => {
    const copy = [...row];
    while (copy.length > 0 && !String(copy[copy.length - 1] || "").trim()) copy.pop();
    return copy;
  };

  const isFolderOnlyRow = (row) => {
    const trimmed = trimTrailingEmptyCells(row);
    const hasOnlyFirstColumn = row[0] && row.slice(1).every((cell) => !String(cell || "").trim());
    const hasCodeAndNameOnly =
      row[0] &&
      row[2] &&
      !String(row[1] || "").trim() &&
      row.slice(3).every((cell) => !String(cell || "").trim());
    return trimmed.length === 1 || hasOnlyFirstColumn || hasCodeAndNameOnly;
  };

  const parseFolderCell = (value) => {
    const text = String(value || "").trim();
    const match = text.match(/^([0-9]+(?:\.[0-9]+)*\.?)\s+(.+)$/);
    if (!match) return { code: text, name: text };
    return { code: match[1].replace(/\.$/, ""), name: match[2].trim() };
  };

  const repairCommaRow = (row) => {
    const trimmed = trimTrailingEmptyCells(row);
    if (trimmed.length <= 5) return trimmed;

    const code = trimmed[0] || "";
    const pmuCode = trimmed[1] || "";
    const description = trimmed[trimmed.length - 1] || "";
    const priceTail = trimmed[trimmed.length - 2] || "";
    const priceHead = trimmed[trimmed.length - 3] || "";
    const hasDecimalPrice = /^\d+$/.test(String(priceTail).trim()) && /^[\d\s]+$/.test(String(priceHead).trim());
    const price = hasDecimalPrice ? `${priceHead},${priceTail}` : priceTail;
    const nameEnd = hasDecimalPrice ? trimmed.length - 3 : trimmed.length - 2;
    const name = trimmed.slice(2, nameEnd).join(",").trim();
    return [code, pmuCode, name, price, description];
  };

  const stripIgnoredColumns = (row, columns = []) =>
    row.filter((_, index) => columns[index] !== "ignore");

  const normalizeImportDataRow = (row, delimiter, columns = []) => {
    const importRow = stripIgnoredColumns(row, columns);
    const trimmed = trimTrailingEmptyCells(importRow);
    if (isFolderOnlyRow(importRow)) {
      const folder = importRow[2]
        ? { code: String(importRow[0] || "").trim(), name: String(importRow[2] || "").trim() }
        : parseFolderCell(importRow[0]);
      return [folder.code, "", folder.name, "", ""];
    }
    if (delimiter === "," && trimmed.length > 5) return repairCommaRow(trimmed);
    const padded = [...trimmed];
    while (padded.length < 5) padded.push("");
    return padded;
  };

  const isImportRowShapeAllowed = (row, delimiter, columns = []) => {
    const normalized = normalizeImportDataRow(row, delimiter, columns);
    return normalized.length === 5;
  };

  const validateImportRows = (parsedRows, delimiter) => {
    const errors = [];
    const rawHeader = trimTrailingEmptyCells(parsedRows[0] || []);
    const rawColumns = rawHeader.map(getImportColumn);
    const header = rawHeader.filter((_, index) => rawColumns[index] !== "ignore");
    const columns = rawColumns.filter((column) => column !== "ignore");
    const required = ["code", "pmuCode", "name", "price", "description"];

    if (header.length !== 5) {
      errors.push(t("import.headerCount", { count: header.length }));
    }
    if (required.some((key) => !columns.includes(key))) {
      errors.push(t("import.headersMismatch"));
    }

    const rows = [];
    parsedRows.slice(1).forEach((row, index) => {
      const excelRow = index + 2;
      if (row.every((cell) => !String(cell || "").trim())) return;
      const normalizedRow = normalizeImportDataRow(row, delimiter, rawColumns);
      if (normalizedRow.length !== 5) {
        errors.push(
          t("import.rowShape", {
            row: excelRow,
            count: trimTrailingEmptyCells(row).length,
          })
        );
        return;
      }

      const item = {};
      normalizedRow.forEach((cell, cellIndex) => {
        item[columns[cellIndex]] = String(cell || "").trim();
      });

      if (!item.name) errors.push(t("import.nameRequired", { row: excelRow }));
      if (item.price && Number.isNaN(Number(String(item.price).replace(/\s/g, "").replace(",", ".")))) {
        errors.push(t("import.priceNumber", { row: excelRow }));
      }
      rows.push(item);
    });

    if (!rows.length) errors.push(t("import.noRows"));
    return { headers: header, rows, errors };
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportRows([]);
    setImportErrors([]);
    setImportHeaders([]);

    try {
      const text = await file.text();
      const parsed = chooseImportParse(text);
      const parsedRows = parsed.rows;
      const delimiter = parsed.delimiter;
      const parseErrors = (parsed.result.errors || []).map((e) => e.message);
      if (parseErrors.length) {
        setImportErrors(parseErrors);
        toast.error(parseErrors[0]);
        return;
      }

      const validation = validateImportRows(parsedRows, delimiter);
      setImportHeaders(validation.headers);
      setImportRows(validation.rows);
      setImportErrors(validation.errors);

      if (validation.errors.length) {
        toast.error(validation.errors[0]);
      } else {
        toast.success(t("import.ready", { count: validation.rows.length }));
      }
    } catch (error) {
      const message = error?.message || t("import.parseFailed");
      setImportErrors([message]);
      toast.error(message);
    }
  };

  const handleImport = async () => {
    if (!importRows.length) {
      toast.info(t("import.chooseFileFirst"));
      return;
    }
    if (importErrors.length) {
      toast.error(t("import.fixIssuesFirst"));
      return;
    }
    setImporting(true);
    try {
      const result = await importServiceCategories(importRows);
      const errorCount = Array.isArray(result.errors) ? result.errors.length : 0;
      toast.success(
        t("import.imported", {
          count: result.created || 0,
          errors: errorCount ? `, ${errorCount} ${t("import.errors")}` : "",
        })
      );
      setShowImportModal(false);
      setImportRows([]);
      setImportFileName("");
      setImportErrors([]);
      setImportHeaders([]);
      loadFolder();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("import.failed"));
    } finally {
      setImporting(false);
    }
  };

  const isEmpty = !loading && categories.length === 0 && positions.length === 0;

  return (
    <div className="sm-page">
      {/* Header */}
      <div className="sm-header">
        <div>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <div className="sm-toolbar-actions">
          <button className="sm-btn-secondary" onClick={() => setShowExportModal(true)}>
            <Download size={15} /> {t("toolbar.export")}
          </button>
          <button className="sm-btn-secondary" onClick={() => setShowImportModal(true)}>
            <Upload size={15} /> {t("toolbar.import")}
          </button>
          <button className="sm-btn-primary" onClick={handleAddCategory}>
            <Plus size={15} /> {t("toolbar.addCategory")}
          </button>
          <button className="sm-btn-primary" onClick={handleAddPosition}>
            <Plus size={15} /> {t("toolbar.addPosition")}
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="sm-breadcrumb">
        <span
          className={`sm-breadcrumb-segment${breadcrumb.length === 0 ? " active" : ""}`}
          onClick={() => navigateTo(-1)}
        >
          📁 {t("breadcrumb.root")}
        </span>
        {breadcrumb.map((segment, index) => (
          <React.Fragment key={segment._id}>
            <span className="sm-breadcrumb-sep">/</span>
            <span
              className={`sm-breadcrumb-segment${index === breadcrumb.length - 1 ? " active" : ""}`}
              onClick={() => navigateTo(index)}
            >
              📁 {segment.name}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Table */}
      <div className="sm-table-wrap">
        {loading ? (
          <div className="sm-loading">{t("loading")}</div>
        ) : isEmpty ? (
          <div className="sm-empty">
            <FolderOpen size={40} />
            <div>{t("empty")}</div>
          </div>
        ) : (
          <table className="sm-table">
            <thead>
              <tr>
                <th>{t("table.name")}</th>
                <th>{t("table.price")}</th>
                <th style={{ width: 80 }}>{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <CategoryItem
                  key={cat._id}
                  category={cat}
                  onOpen={openFolder}
                  onEdit={handleEditCategory}
                  onDelete={handleDeleteCategory}
                />
              ))}
              {positions.map((pos) => (
                <PositionItem
                  key={pos._id}
                  position={pos}
                  onEdit={handleEditPosition}
                  onDelete={handleDeletePosition}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Category Side Drawer */}
      <CategoryModal
        open={showCategoryModal}
        editing={editingCategory}
        currentFolder={currentFolder}
        onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
        onSaved={loadFolder}
        onOpenCategory={(cat) => setEditingCategory(cat)}
      />

      {/* Position Side Drawer */}
      <PositionModal
        open={showPositionModal}
        editing={editingPosition}
        currentFolder={currentFolder}
        onClose={() => { setShowPositionModal(false); setEditingPosition(null); }}
        onSaved={loadFolder}
      />

      {showExportModal && createPortal(
        <div className="sm-dialog-overlay" onClick={(e) => e.target === e.currentTarget && setShowExportModal(false)}>
          <div className="sm-dialog sm-dialog-wide" role="dialog" aria-modal="true">
            <div className="sm-modal-header">
              <h2><FileSpreadsheet size={18} /> {t("export.title")}</h2>
              <button className="sm-modal-close" onClick={() => setShowExportModal(false)} aria-label={t("close")}>
                <X size={18} />
              </button>
            </div>
            <div className="sm-dialog-body">
              <div className="sm-dialog-actions">
                <button className="sm-btn-cancel" type="button" onClick={handleSelectAllExport}>
                  {selectedExportCategories.length === collectCategoryIds(categoryTree).length
                    ? t("export.clearAll") : t("export.selectAll")}
                </button>
                <span className="sm-selection-count">
                  {selectedExportCategories.length > 0
                    ? t("export.selectedSummary", { count: selectedExportCategories.length })
                    : t("export.allSelected")}
                </span>
              </div>
              <div className="sm-category-tree">
                {categoryTree.map((category) => (
                  <CategoryTreeNode
                    key={category._id}
                    category={category}
                    selectedIds={selectedExportCategories}
                    onToggle={toggleExportCategory}
                  />
                ))}
              </div>
            </div>
            <div className="sm-dialog-footer">
              <button className="sm-btn-cancel" onClick={() => setShowExportModal(false)}>{t("export.close")}</button>
              <button className="sm-btn-submit" onClick={handleExport} disabled={exporting}>
                {exporting ? t("export.downloading") : t("export.download")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showImportModal && createPortal(
        <div className="sm-dialog-overlay" onClick={(e) => e.target === e.currentTarget && setShowImportModal(false)}>
          <div className="sm-dialog" role="dialog" aria-modal="true">
            <div className="sm-modal-header">
              <h2><Upload size={18} /> {t("import.title")}</h2>
              <button className="sm-modal-close" onClick={() => setShowImportModal(false)} aria-label={t("close")}>
                <X size={18} />
              </button>
            </div>
            <div className="sm-dialog-body">
              <button className="sm-template-btn" type="button" onClick={downloadTemplate}>
                <FileSpreadsheet size={16} /> {t("import.downloadTemplate")}
              </button>
              <label className="sm-upload-box">
                <Upload size={22} />
                <span>{importFileName || t("import.chooseFile")}</span>
                <input type="file" accept=".csv,text/csv" onChange={handleImportFile} />
              </label>
              {importRows.length > 0 && (
                <div className="sm-import-preview">
                  <div className="sm-import-preview-header">
                    <strong>{t("import.rowsReady", { count: importRows.length })}</strong>
                    <span>{importHeaders.join(" | ")}</span>
                  </div>
                  <div className="sm-import-preview-table">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("position.serviceCode")}</th>
                          <th>{t("position.pmuCode")}</th>
                          <th>{t("position.name")}</th>
                          <th>{t("position.price")}</th>
                          <th>{t("position.description")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 8).map((row, index) => (
                          <tr key={`${row.code}-${index}`}>
                            <td>{row.code}</td>
                            <td>{row.pmuCode}</td>
                            <td>{row.name}</td>
                            <td>{row.price}</td>
                            <td>{row.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {importErrors.length > 0 && (
                <div className="sm-import-errors">
                  <strong>{t("import.validationIssues_one", { count: importErrors.length })}</strong>
                  {importErrors.slice(0, 6).map((error, index) => (
                    <span key={`${error}-${index}`}>{error}</span>
                  ))}
                  {importErrors.length > 6 && (
                    <span>{t("import.andMore", { count: importErrors.length - 6 })}</span>
                  )}
                </div>
              )}
            </div>
            <div className="sm-dialog-footer">
              <button className="sm-btn-cancel" onClick={() => setShowImportModal(false)}>{t("import.close")}</button>
              <button className="sm-btn-submit" onClick={handleImport} disabled={importing || !importRows.length || importErrors.length > 0}>
                {importing ? t("import.importing") : t("import.doImport")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const CategoryTreeNode = ({ category, selectedIds, onToggle, depth = 0 }) => {
  const ids = [category._id, ...collectTreeIds(category.children || [])];
  const checked = ids.every((id) => selectedIds.includes(id));
  const partial = !checked && ids.some((id) => selectedIds.includes(id));

  return (
    <div className="sm-tree-row-wrap">
      <label className="sm-tree-row" style={{ paddingLeft: 12 + depth * 22 }}>
        <input
          type="checkbox"
          checked={checked}
          ref={(el) => { if (el) el.indeterminate = partial; }}
          onChange={() => onToggle(category)}
        />
        <FolderOpen size={15} />
        <span>{category.name}</span>
      </label>
      {(category.children || []).map((child) => (
        <CategoryTreeNode
          key={child._id}
          category={child}
          selectedIds={selectedIds}
          onToggle={onToggle}
          depth={depth + 1}
        />
      ))}
    </div>
  );
};

const collectTreeIds = (nodes) =>
  nodes.flatMap((node) => [node._id, ...collectTreeIds(node.children || [])]);

export default ServiceManager;
