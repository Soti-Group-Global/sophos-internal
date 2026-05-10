import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Trash2, X, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
    getAllServicePositions,
    getApplicationServicePositions,
    addApplicationServicePosition,
    removeApplicationServicePosition,
    getDoctor,
} from "../utils/api";
import "../styles/Service.css";

const normalizePositions = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.positions)) return data.positions;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.positions)) return data.data.positions;
    return [];
};

const Service = ({ applicationId }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [positions, setPositions] = useState([]);
    const [myPositions, setMyPositions] = useState([]);
    const [selectedPositionIds, setSelectedPositionIds] = useState([]);
    const [addedPositions, setAddedPositions] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [doctorSpecialityId, setDoctorSpecialityId] = useState(null);

    // Load doctor's speciality on mount
    useEffect(() => {
        const loadDoctorSpeciality = async () => {
            try {
                const res = await getDoctor();
                const doc = res?.data || res;
                const specialityId = doc?.specialtyIds?.[0];
                if (specialityId) setDoctorSpecialityId(String(specialityId));
            } catch {}
        };
        loadDoctorSpeciality();
    }, []);

    // Load added positions from backend
    useEffect(() => {
        const loadFromServer = async () => {
            if (!applicationId) {
                setAddedPositions([]);
                return;
            }
            try {
                const data = await getApplicationServicePositions(applicationId);
                const serverPositions = data?.positions || [];
                if (Array.isArray(serverPositions)) {
                    setAddedPositions(serverPositions);
                }
            } catch {
                toast.error(t("service.loadFailed", "Unable to load saved positions from server"));
            }
        };
        loadFromServer();
    }, [applicationId, t]);

    // Load all positions + doctor's matched positions when modal opens
    useEffect(() => {
        if (!isOpen) return;
        const loadPositions = async () => {
            setLoading(true);
            try {
                const [allData, myData] = await Promise.all([
                    getAllServicePositions({ all: true, limit: 5000 }),
                    doctorSpecialityId
                        ? getAllServicePositions({ speciality: doctorSpecialityId, limit: 5000 })
                        : Promise.resolve([]),
                ]);
                setPositions(normalizePositions(allData));
                setMyPositions(normalizePositions(myData));
            } catch (error) {
                toast.error(error?.response?.data?.message || t("service.loadFailed", "Unable to load service positions"));
            } finally {
                setLoading(false);
            }
        };
        loadPositions();
    }, [isOpen, doctorSpecialityId, t]);

    useEffect(() => {
        setSelectedPositionIds(addedPositions.map((position) => position._id));
    }, [addedPositions, isOpen]);

    // Derive tab positions
    const myPositionIds = new Set(myPositions.map((p) => p._id));
    const tabPositions = (() => {
        if (activeTab === "my") return myPositions;
        if (activeTab === "other") return positions.filter((p) => !myPositionIds.has(p._id));
        return positions;
    })();

    const filteredPositions = tabPositions.filter((p) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (p.name || "").toLowerCase().includes(q) ||
            (p.serviceCode || "").toLowerCase().includes(q) ||
            (p.pmuCode || "").toLowerCase().includes(q) ||
            (p.code || "").toLowerCase().includes(q)
        );
    });

    const handleSelectPosition = (position) => {
        if (!position?._id) return;
        const isSelected = selectedPositionIds.includes(position._id);

        if (isSelected) {
            setSelectedPositionIds((prev) => prev.filter((id) => id !== position._id));
            setAddedPositions((prev) => prev.filter((p) => p._id !== position._id));
            if (!applicationId) return;
            (async () => {
                try {
                    await removeApplicationServicePosition(applicationId, position._id);
                    toast.success(t("service.remove", "Removed"));
                } catch {
                    toast.error(t("service.removeFailed", "Failed to remove on server"));
                }
            })();
            return;
        }

        setSelectedPositionIds((prev) => (prev.includes(position._id) ? prev : [...prev, position._id]));
        setAddedPositions((prev) =>
            prev.some((existing) => existing._id === position._id) ? prev : [...prev, position]
        );

        if (!applicationId) {
            toast.info(t("service.positionAddedLocal", "Position added locally (no application selected)"));
            return;
        }

        (async () => {
            try {
                await addApplicationServicePosition(applicationId, position._id);
                toast.success(t("service.positionAdded", "Position added"));
            } catch {
                toast.error(t("service.saveFailed", "Failed to save to server"));
            }
        })();
    };

    const handleDeleteAddedPosition = (positionId) => {
        const newList = addedPositions.filter((position) => position._id !== positionId);
        setAddedPositions(newList);
        setSelectedPositionIds((prev) => prev.filter((id) => id !== positionId));

        if (!applicationId) {
            toast.info(t("service.removeLocal", "Removed locally (no application selected)"));
            return;
        }

        (async () => {
            try {
                await removeApplicationServicePosition(applicationId, positionId);
                toast.success(t("service.remove", "Removed"));
            } catch {
                toast.error(t("service.removeFailed", "Failed to remove on server"));
            }
        })();
    };

    const formatPrice = (price) => {
        if (price == null || price === "") return null;
        const n = Number(price);
        if (Number.isNaN(n)) return null;
        return n.toLocaleString("ru-RU");
    };

    const handleOpenModal = () => {
        setActiveTab("all");
        setSearchQuery("");
        setIsOpen(true);
    };

    const tabs = [
        { key: "all",   label: t("service.tabAll",   "All") },
        { key: "my",    label: t("service.tabMy",    "My Services") },
        { key: "other", label: t("service.tabOther", "Other Services") },
    ];

    return (
        <div className="service-tab">
            <div className="service-page-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div className="service-page-section__title">
                        {t("service.addedServices", "Added Services")}
                    </div>
                    <div>
                        <button className="add-service-btn" onClick={handleOpenModal}>
                            {t("service.addServices", "Add Service")}
                        </button>
                    </div>
                </div>
                {addedPositions.length === 0 ? (
                    <div className="service-page-empty">{t("service.noAddedPositions", "No service added yet.")}</div>
                ) : (
                    <table className="service-added-table">
                        <thead>
                            <tr>
                                <th>{t("service.code", "Code")}</th>
                                <th>{t("service.name", "Name")}</th>
                                <th>{t("service.action", "Action")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {addedPositions.map((position) => (
                                <tr key={position._id} className="service-added-row">
                                    <td className="service-added-td">{position.serviceCode || position.pmuCode || "—"}</td>
                                    <td className="service-added-td">{position.name || t("service.unnamedPosition", "Unnamed position")}</td>
                                    <td className="service-added-td">
                                        <button
                                            type="button"
                                            className="service-delete-btn"
                                            onClick={() => handleDeleteAddedPosition(position._id)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isOpen && createPortal(
                <div
                    className="service-modal-overlay"
                    onClick={(event) => event.target === event.currentTarget && setIsOpen(false)}
                >
                    <div className="service-modal" role="dialog" aria-modal="true" aria-label={t("service.addServices", "Add Service")}>
                        <div className="service-modal-header">
                            <h2>{t("service.addServices", "Add Service")}</h2>
                            <button
                                type="button"
                                className="service-modal-close"
                                onClick={() => setIsOpen(false)}
                                aria-label={t("close", "Close")}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="service-modal-tabs">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    className={`service-modal-tab${activeTab === tab.key ? " active" : ""}`}
                                    onClick={() => { setActiveTab(tab.key); setSearchQuery(""); }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="service-modal-search">
                            <div className="service-modal-search__row">
                                <Search size={15} className="service-modal-search__icon" />
                                <input
                                    type="text"
                                    className="service-modal-search__input"
                                    placeholder={t("service.searchPlaceholder", "Search services...")}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="service-modal-body">
                            {loading ? (
                                <div className="service-modal-state">{t("loading", "Loading...")}</div>
                            ) : filteredPositions.length === 0 ? (
                                <div className="service-modal-state">{t("service.noPositions", "No services found.")}</div>
                            ) : (
                                <div className="service-position-list">
                                    {filteredPositions.map((position) => {
                                        const isSelected = selectedPositionIds.includes(position._id);
                                        return (
                                            <div
                                                key={position._id || position.id || position.serviceCode || position.name}
                                                className={`service-position-card${isSelected ? " selected" : ""}`}
                                                onClick={() => handleSelectPosition(position)}
                                                tabIndex={0}
                                                role="button"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        handleSelectPosition(position);
                                                    }
                                                }}
                                            >
                                                <div className="service-position-card__left">
                                                    <span className="service-position-card__name">
                                                        {position.name || t("service.unnamedPosition", "Unnamed position")}
                                                    </span>
                                                    {(position.serviceCode || position.pmuCode || position.code) && (
                                                        <span className="service-position-card__code">
                                                            {position.serviceCode || position.pmuCode || position.code}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="service-position-card__right">
                                                    {formatPrice(position.price) && (
                                                        <span className="service-position-card__price">
                                                            {formatPrice(position.price)}
                                                        </span>
                                                    )}
                                                    {isSelected && (
                                                        <>
                                                            <span className="service-position-card__check">
                                                                <Check size={15} />
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="service-position-card__trash"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteAddedPosition(position._id);
                                                                }}
                                                                aria-label={t("service.unselect", "Unselect")}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
};

export default Service;
