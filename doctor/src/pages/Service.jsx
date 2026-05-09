import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Trash2, X, Search } from "lucide-react";
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
    const [searchQuery, setSearchQuery] = useState("");

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

    const handleSelectPosition = (position) => {
        if (!position?._id) return;

        const isSelected = selectedPositionIds.includes(position._id);

        if (isSelected) {
            // remove
            setSelectedPositionIds((prev) => prev.filter((id) => id !== position._id));
            setAddedPositions((prev) => prev.filter((p) => p._id !== position._id));

            if (!applicationId) return;
            (async () => {
                try {
                    await removeApplicationServicePosition(applicationId, position._id);
                    toast.success(t("service.remove", "Removed"));
                } catch (err) {
                    toast.error(t("service.removeFailed", "Failed to remove on server"));
                }
            })();
            return;
        }

        // add immediately (match manager behavior)
        setSelectedPositionIds((prev) => (prev.includes(position._id) ? prev : [...prev, position._id]));
        setAddedPositions((prev) => (prev.some((existing) => existing._id === position._id) ? prev : [...prev, position]));

        if (!applicationId) {
            toast.info(t("service.positionAddedLocal", "Position added locally (no application selected)"));
            return;
        }

        (async () => {
            try {
                await addApplicationServicePosition(applicationId, position._id);
                toast.success(t("service.positionAdded", "Position added"));
            } catch (err) {
                toast.error(t("service.saveFailed", "Failed to save to server"));
            }
        })();
    };

    const formatPrice = (price) => {
        if (price == null || price === "") return "—";
        const n = Number(price);
        if (Number.isNaN(n)) return String(price);
        return n.toLocaleString("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
    };

    const filteredPositions = (positions || []).filter((p) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (p.name || "").toLowerCase().includes(q)
            || (p.serviceCode || "").toLowerCase().includes(q)
            || (p.pmuCode || "").toLowerCase().includes(q)
            || (p.code || "").toLowerCase().includes(q);
    });

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
								<X size={16} />
							</button>
						</div>

						<div className="service-modal-search">
							<div className="service-modal-search__row">
								<Search size={15} className="service-modal-search__icon" />
								<input
									type="text"
									className="service-modal-search__input"
									placeholder={t("search", "Search...")}
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
								/>
							</div>
						</div>

						<div className="service-modal-body">
							{loading ? (
								<div className="service-modal-state">{t("loading", "Loading...")}</div>
							) : filteredPositions.length === 0 ? (
								<div className="service-modal-state">{t("service.noPositions", "No positions added yet.")}</div>
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
														{position.serviceCode || position.pmuCode || position.code || t("service.unnamedPosition", "Unnamed position")}
													</span>
													{/* <span className="service-position-card__meta">
														{position.name && <span>{position.name}</span>}
														{position.serviceCode && position.name && <span>•</span>}
														{position.serviceCode && <span>{position.serviceCode}</span>}
														{position.pmuCode && <span>{position.pmuCode}</span>}
													</span> */}
												</div>
												<div className="service-position-card__right">
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