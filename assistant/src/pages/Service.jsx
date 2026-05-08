import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { getAllServicePositions, getApplicationServicePositions, addApplicationServicePosition, removeApplicationServicePosition } from "../utils/api";
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
    const [selectedPositionIds, setSelectedPositionIds] = useState([]);
    const [addedPositions, setAddedPositions] = useState([]);

    // Load added positions from backend (application field)
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
            } catch (err) {
                toast.error(t("service.loadFailed", "Unable to load saved positions from server"));
            }
        };

        loadFromServer();
    }, [applicationId, t]);

    useEffect(() => {
        if (!isOpen) return;

        const loadPositions = async () => {
            setLoading(true);
            try {
                const data = await getAllServicePositions({ limit: 5000 });
                setPositions(normalizePositions(data));
            } catch (error) {
                toast.error(error?.response?.data?.message || t("service.loadFailed", "Unable to load service positions"));
            } finally {
                setLoading(false);
            }
        };

        loadPositions();
    }, [isOpen, t]);

    useEffect(() => {
        setSelectedPositionIds(addedPositions.map((position) => position._id));
    }, [addedPositions, isOpen]);

    const toggleSelectedPosition = (positionId) => {
        setSelectedPositionIds((prev) => (
            prev.includes(positionId)
                ? prev.filter((id) => id !== positionId)
                : [...prev, positionId]
        ));
    };

    const handleAddSelected = () => {
        if (!selectedPositionIds.length) {
            toast.info(t("service.selectPositionFirst", "Select at least one position first"));
            return;
        }

        // Merge selected positions with existing and persist to backend
        const selectedPositions = positions.filter((position) => selectedPositionIds.includes(position._id));
        const merged = [...addedPositions];
        selectedPositions.forEach((position) => {
            if (!merged.some((existing) => existing._id === position._id)) merged.push(position);
        });

        setAddedPositions(merged);
        setSelectedPositionIds([]);
        setIsOpen(false);

        (async () => {
            if (!applicationId) {
                toast.info(t("service.positionAddedLocal", "Position added locally (no application selected)"));
                return;
            }
            try {
                // Add each selected position to the application
                for (const positionId of selectedPositionIds) {
                    await addApplicationServicePosition(applicationId, positionId);
                }
                toast.success(t("service.positionAdded", "Position added"));
            } catch (err) {
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
            } catch (err) {
                toast.error(t("service.removeFailed", "Failed to remove on server"));
            }
        })();
    };

    return (
        <div className="service-tab">
            

                <div className="service-page-section">
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
                        <div className="service-page-section__title">
                            {t("service.addedPositions", "Added Positions")}
                        </div>
                        <div>
                            <button className="add-service-btn" onClick={() => setIsOpen(true)}>
                                {t("service.addServices", "Add service")}
                            </button>
                        </div>
                    </div>
                    {addedPositions.length === 0 ? (
                        <div className="service-page-empty">{t("service.noAddedPositions", "No positions added yet.")}</div>
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
                                        <td className="service-added-td">{position.serviceCode || position.pmuCode || '—'}</td>
                                        <td className="service-added-td">{position.name || t("service.unnamedPosition", "Unnamed position")}</td>
                                        <td className="service-added-td">
                                            <button type="button" className="service-delete-btn" onClick={() => handleDeleteAddedPosition(position._id)}>
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
                    <div className="service-modal" role="dialog" aria-modal="true" aria-label={t("service.addServices", "Add service")}>
                        <div className="service-modal-header">
                            <h2>{t("service.addServices", "Add service")}</h2>
                            <button
                                type="button"
                                className="service-modal-close"
                                onClick={() => setIsOpen(false)}
                                aria-label={t("close", "Close")}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="service-modal-body">
                            <div className="service-modal-section-title">
                                {t("service.addedPositions", "Added Positions")}
                            </div>

                            {loading ? (
                                <div className="service-modal-state">{t("loading", "Loading...")}</div>
                            ) : positions.length === 0 ? (
                                <div className="service-modal-state">{t("service.noPositions", "No positions added yet.")}</div>
                            ) : (
                                <div className="service-position-list">
                                    {positions.map((position) => (
                                        <div
                                            key={position._id || position.id || position.serviceCode || position.name}
                                            className={`service-position-card${selectedPositionIds.includes(position._id) ? " selected" : ""}`}
                                            onClick={() => toggleSelectedPosition(position._id)}
                                            tabIndex={0}
                                            role="button"
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    toggleSelectedPosition(position._id);
                                                }
                                            }}
                                        >
                                            <div className="service-position-card__top">
                                                <strong>{position.name || t("service.unnamedPosition", "Unnamed position")}</strong>
                                            </div>
                                            <div className="service-position-card__meta">
                                                {position.serviceCode ? <span>{position.serviceCode}</span> : null}
                                                {position.pmuCode ? <span>{position.pmuCode}</span> : null}
                                            </div>
                                            {position.description ? (
                                                <p>{position.description}</p>
                                            ) : null}
                                            <div className="service-position-card__actions">
                                                {selectedPositionIds.includes(position._id) ? (
                                                    <span className="service-position-card__selected-actions">
                                                        <Check size={16} className="service-position-card__tick" />
                                                        <button
                                                            type="button"
                                                            className="service-position-card__unselect-btn"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                toggleSelectedPosition(position._id);
                                                            }}
                                                            aria-label={t("service.unselect", "Unselect")}
                                                        >
                                                                <Trash2 size={16} />
                                                            </button>
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="service-modal-footer">
                            <button type="button" className="service-modal-close-btn" onClick={() => setIsOpen(false)}>
                                {t("close", "Close")}
                            </button>
                            <button type="button" className="service-modal-add-btn" onClick={handleAddSelected}>
                                {t("service.add", "Add")}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
};

export default Service;