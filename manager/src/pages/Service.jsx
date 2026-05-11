import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, Trash2, X, Search, ChevronDown } from "lucide-react";
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

const formatPrice = (value) => {
	if (value === undefined || value === null || value === "") return null;
	const numeric = Number(value);
	if (Number.isNaN(numeric)) return null;
	return numeric.toLocaleString("ru-RU");
};

const Service = ({ applicationId }) => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [positions, setPositions] = useState([]);
	const [selectedPositionIds, setSelectedPositionIds] = useState([]);
	const [addedPositions, setAddedPositions] = useState([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [openCategories, setOpenCategories] = useState(new Set());

	const toggleCategory = (catKey) => {
		setOpenCategories((prev) => {
			const next = new Set(prev);
			next.has(catKey) ? next.delete(catKey) : next.add(catKey);
			return next;
		});
	};

	const filteredPositions = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return positions;
		return positions.filter((position) =>
			[position.name, position.serviceCode, position.pmuCode, position.code]
				.filter(Boolean)
				.some((v) => String(v).toLowerCase().includes(query))
		);
	}, [positions, searchQuery]);

	const categoryGroups = useMemo(() => {
		const map = new Map();
		filteredPositions.forEach((pos) => {
			const catId = pos.category?._id || pos.category || "__none__";
			const catName = pos.category?.name || t("service.uncategorized", "Other");
			if (!map.has(catId)) map.set(catId, { catId, catName, positions: [] });
			map.get(catId).positions.push(pos);
		});
		return Array.from(map.values()).sort((a, b) =>
			a.catName === t("service.uncategorized", "Other") ? 1
			: b.catName === t("service.uncategorized", "Other") ? -1
			: a.catName.localeCompare(b.catName)
		);
	}, [filteredPositions, t]);

	useEffect(() => {
		const loadFromServer = async () => {
			if (!applicationId) { setAddedPositions([]); return; }
			try {
				const data = await getApplicationServicePositions(applicationId);
				const serverPositions = data?.positions || [];
				if (Array.isArray(serverPositions)) setAddedPositions(serverPositions);
			} catch {
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
				const data = await getAllServicePositions({ all: true, limit: 5000 });
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
		setSelectedPositionIds(addedPositions.map((p) => p._id));
	}, [addedPositions, isOpen]);

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
		setAddedPositions((prev) => (prev.some((e) => e._id === position._id) ? prev : [...prev, position]));

		if (!applicationId) {
			toast.info(t("service.positionAddedLocal", "Position added locally"));
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
		setAddedPositions((prev) => prev.filter((p) => p._id !== positionId));
		setSelectedPositionIds((prev) => prev.filter((id) => id !== positionId));
		if (!applicationId) return;
		(async () => {
			try {
				await removeApplicationServicePosition(applicationId, positionId);
				toast.success(t("service.remove", "Removed"));
			} catch {
				toast.error(t("service.removeFailed", "Failed to remove on server"));
			}
		})();
	};

	return (
		<div className="service-tab">
			<div className="service-page-section">
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
					<div className="service-page-section__title">
						{t("service.addedServices", "Added Services")}
					</div>
					<div>
						<button className="add-service-btn" onClick={() => { setSearchQuery(""); setIsOpen(true); }}>
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
								<th>{t("service.price", "Price")}</th>
								<th>{t("service.action", "Action")}</th>
							</tr>
						</thead>
						<tbody>
							{addedPositions.map((position) => (
								<tr key={position._id} className="service-added-row">
									<td className="service-added-td">{position.serviceCode || position.pmuCode || "—"}</td>
									<td className="service-added-td">{position.name || t("service.unnamedPosition", "Unnamed position")}</td>
									<td className="service-added-td">{formatPrice(position.price) ?? "—"}</td>
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
					onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
				>
					<div className="service-modal" role="dialog" aria-modal="true">
						<div className="service-modal-header">
							<h2>{t("service.addServices", "Add Service")}</h2>
							<button type="button" className="service-modal-close" onClick={() => setIsOpen(false)}>
								<X size={16} />
							</button>
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
							) : categoryGroups.length === 0 ? (
								<div className="service-modal-state">{t("service.noPositions", "No services found.")}</div>
							) : (
								<div className="service-position-list">
									{categoryGroups.map(({ catId, catName, positions: groupPositions }) => {
										const isGroupOpen = searchQuery.trim() ? true : openCategories.has(catId);
										const selectedCount = groupPositions.filter((p) => selectedPositionIds.includes(p._id)).length;
										return (
											<div key={catId} className="svc-category-group">
												<button
													type="button"
													className={`svc-category-header${isGroupOpen ? " svc-category-header--open" : ""}`}
													onClick={() => !searchQuery.trim() && toggleCategory(catId)}
												>
													<span className="svc-category-name">{catName}</span>
													<span className="svc-category-meta">
														<span className="svc-category-count">{groupPositions.length}</span>
														{selectedCount > 0 && (
															<span className="svc-category-selected-badge">{selectedCount} added</span>
														)}
														{!searchQuery.trim() && (
															<ChevronDown
																size={14}
																className="svc-category-chevron"
																style={{ transform: isGroupOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
															/>
														)}
													</span>
												</button>

												{isGroupOpen && (
													<div className="svc-category-body">
														{groupPositions.map((position) => {
															const isSelected = selectedPositionIds.includes(position._id);
															return (
																<div
																	key={position._id || position.serviceCode || position.name}
																	className={`service-position-card${isSelected ? " selected" : ""}`}
																	onClick={() => handleSelectPosition(position)}
																	tabIndex={0}
																	role="button"
																	onKeyDown={(e) => {
																		if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectPosition(position); }
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
																				<span className="service-position-card__check"><Check size={15} /></span>
																				<button
																					type="button"
																					className="service-position-card__trash"
																					onClick={(e) => { e.stopPropagation(); handleDeleteAddedPosition(position._id); }}
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
