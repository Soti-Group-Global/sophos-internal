import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Folder, FileText, Check, Trash2, FolderOpen, ChevronRight, X, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
    getServiceCategoryFolderContents,
    getApplicationServicePositions,
    addApplicationServicePosition,
    removeApplicationServicePosition,
} from "../utils/api";
import "../styles/Service.css";

const normalizePositions = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.positions)) return data.positions;
    if (Array.isArray(data?.data)) return data.data;
    return [];
};

const formatPrice = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return null;
    return `₽ ${numeric.toLocaleString("ru-RU")}`;
};

const Service = ({ applicationId }) => {
    const { t } = useTranslation();

    const [drawerOpen, setDrawerOpen]         = useState(false);
    const [currentFolder, setCurrentFolder]   = useState(null);
    const [breadcrumb, setBreadcrumb]         = useState([]);
    const [categories, setCategories]         = useState([]);
    const [positions, setPositions]           = useState([]);
    const [loading, setLoading]               = useState(false);
    const [addedPositions, setAddedPositions] = useState([]);
    const [selectedIds, setSelectedIds]       = useState(new Set());

    // Load added services on mount
    useEffect(() => {
        if (!applicationId) return;
        (async () => {
            try {
                const data = await getApplicationServicePositions(applicationId);
                const list = data?.positions || [];
                setAddedPositions(list);
                setSelectedIds(new Set(list.map((p) => p._id)));
            } catch {
                toast.error(t("service.loadFailed", "Unable to load saved positions"));
            }
        })();
    }, [applicationId, t]);

    // Load folder contents
    const loadFolder = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getServiceCategoryFolderContents({ parent: currentFolder || "root" });
            setCategories(Array.isArray(data.categories) ? data.categories : []);
            setPositions(Array.isArray(data.positions) ? data.positions : []);
        } catch (err) {
            toast.error(err?.response?.data?.message || t("service.loadFailed", "Failed to load"));
        } finally {
            setLoading(false);
        }
    }, [currentFolder, t]);

    useEffect(() => {
        if (drawerOpen) loadFolder();
    }, [drawerOpen, loadFolder]);

    const openDrawer = () => {
        setCurrentFolder(null);
        setBreadcrumb([]);
        setDrawerOpen(true);
    };

    const closeDrawer = () => setDrawerOpen(false);

    const openFolder = (category) => {
        setBreadcrumb((prev) => [...prev, { _id: category._id, name: category.name }]);
        setCurrentFolder(category._id);
    };

    const navigateTo = (index) => {
        if (index < 0) {
            setBreadcrumb([]);
            setCurrentFolder(null);
        } else {
            const segment = breadcrumb[index];
            setBreadcrumb((prev) => prev.slice(0, index + 1));
            setCurrentFolder(segment?._id || null);
        }
    };

    const handleTogglePosition = async (position) => {
        if (!position?._id) return;
        const isAdded = selectedIds.has(position._id);

        if (isAdded) {
            setSelectedIds((prev) => { const n = new Set(prev); n.delete(position._id); return n; });
            setAddedPositions((prev) => prev.filter((p) => p._id !== position._id));
            if (!applicationId) return;
            try {
                await removeApplicationServicePosition(applicationId, position._id);
                toast.success(t("service.remove", "Removed"));
            } catch {
                toast.error(t("service.removeFailed", "Failed to remove"));
            }
        } else {
            setSelectedIds((prev) => new Set([...prev, position._id]));
            setAddedPositions((prev) => prev.some((p) => p._id === position._id) ? prev : [...prev, position]);
            if (!applicationId) return;
            try {
                await addApplicationServicePosition(applicationId, position._id);
                toast.success(t("service.positionAdded", "Added"));
            } catch {
                toast.error(t("service.saveFailed", "Failed to save"));
            }
        }
    };

    const handleRemoveAdded = async (positionId) => {
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(positionId); return n; });
        setAddedPositions((prev) => prev.filter((p) => p._id !== positionId));
        if (!applicationId) return;
        try {
            await removeApplicationServicePosition(applicationId, positionId);
            toast.success(t("service.remove", "Removed"));
        } catch {
            toast.error(t("service.removeFailed", "Failed to remove"));
        }
    };

    const isEmpty = !loading && categories.length === 0 && positions.length === 0;

    return (
        <div className="svc-folder-page">
            {/* Header row */}
            <div className="svc-header-row">
                <span className="svc-added-title">{t("service.addedServices", "Added Services")}</span>
                <button className="svc-add-btn" onClick={openDrawer}>
                    <Plus size={15} />
                    {t("service.addServices", "Add Service")}
                </button>
            </div>

            {/* Added services table */}
            {addedPositions.length === 0 ? (
                <div className="svc-added-empty">{t("service.noAddedPositions", "No services added yet.")}</div>
            ) : (
                <table className="service-added-table">
                    <thead>
                        <tr>
                            <th>{t("service.code", "Code")}</th>
                            <th>{t("service.name", "Name")}</th>
                            <th>{t("service.price", "Price")}</th>
                            <th>{t("service.action", "Action")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {addedPositions.map((pos) => (
                            <tr key={pos._id} className="service-added-row">
                                <td className="service-added-td">{pos.serviceCode || pos.pmuCode || "—"}</td>
                                <td className="service-added-td">{pos.name || t("service.unnamedPosition", "Unnamed position")}</td>
                                <td className="service-added-td">{formatPrice(pos.price) ?? "—"}</td>
                                <td className="service-added-td">
                                    <button type="button" className="service-delete-btn" onClick={() => handleRemoveAdded(pos._id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Side drawer */}
            {drawerOpen && createPortal(
                <>
                    <div className="svc-drawer-overlay" onClick={closeDrawer} />
                    <div className="svc-drawer">
                        {/* Header */}
                        <div className="svc-drawer-header">
                            <span className="svc-drawer-title">{t("service.addServices", "Add Service")}</span>
                            <button type="button" className="svc-drawer-close" onClick={closeDrawer}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Breadcrumb */}
                        <div className="svc-drawer-breadcrumb">
                            <span
                                className={`sm-breadcrumb-segment${breadcrumb.length === 0 ? " active" : ""}`}
                                onClick={() => navigateTo(-1)}
                            >
                                📁 {t("service.rootFolder", "All Services")}
                            </span>
                            {breadcrumb.map((seg, idx) => (
                                <span key={seg._id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <ChevronRight size={12} style={{ color: "#cbd5e1" }} />
                                    <span
                                        className={`sm-breadcrumb-segment${idx === breadcrumb.length - 1 ? " active" : ""}`}
                                        onClick={() => navigateTo(idx)}
                                    >
                                        📁 {seg.name}
                                    </span>
                                </span>
                            ))}
                        </div>

                        {/* Folder content */}
                        <div className="svc-drawer-body">
                            {loading ? (
                                <div className="sm-loading">{t("loading", "Loading...")}</div>
                            ) : isEmpty ? (
                                <div className="sm-empty">
                                    <FolderOpen size={32} />
                                    <div>{t("service.emptyFolder", "This folder is empty.")}</div>
                                </div>
                            ) : (
                                <table className="sm-table">
                                    <thead>
                                        <tr>
                                            <th>{t("service.name", "Name")}</th>
                                            <th>{t("service.price", "Price")}</th>
                                            <th style={{ width: 36 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categories.map((cat) => (
                                            <tr
                                                key={cat._id}
                                                className="sm-folder-row"
                                                onClick={() => openFolder(cat)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <td>
                                                    <div className="sm-name-cell folder">
                                                        <Folder size={16} className="sm-folder-icon" />
                                                        <span className="sm-name-text">{cat.name}</span>
                                                    </div>
                                                </td>
                                                <td className="sm-price-cell">—</td>
                                                <td><ChevronRight size={14} style={{ color: "#94a3b8" }} /></td>
                                            </tr>
                                        ))}
                                        {positions.map((pos) => {
                                            const isAdded = selectedIds.has(pos._id);
                                            return (
                                                <tr
                                                    key={pos._id}
                                                    className={`sm-position-row${isAdded ? " sm-position-row--selected" : ""}`}
                                                    onClick={() => handleTogglePosition(pos)}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <td>
                                                        <div className="sm-name-cell">
                                                            <FileText size={14} className="sm-file-icon" />
                                                            <span className="sm-name-text">{pos.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="sm-price-cell">{formatPrice(pos.price) ?? "—"}</td>
                                                    <td>
                                                        {isAdded && <Check size={14} style={{ color: "#1e40af" }} />}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default Service;
