import {
  FiRefreshCcw,
  FiPackage,
  FiEdit,
  FiFilePlus,
  FiSearch,
  FiTrash2,
  FiCalendar,
  FiCheckSquare,
  FiEye,
  FiX,
  FiUser,
  FiPhone,
  FiMail,
  FiEdit2,
  FiAlertTriangle,
} from "react-icons/fi";
import "../../styles/StockRequestsTab.css";
import SearchBar from "../SearchBar/SearchBar";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  deleteStockRequest,
  getStockRequestDetails,
  getStockRequests,
  updateStockRequestItemStatus,
} from "../../utils/api";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

const StockRequestsTab = () => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewRequestModal, setViewRequestModal] = useState({
    open: false,
    req: null,
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({
    open: false,
    type: "", // 'receive' or 'delete'
    req: null,
    message: "",
  });
  const [editingItemId, setEditingItemId] = useState(null);

  const categories = [
    "All",
    "Pending",
    "Partially Approved",
    "Approved",
    "Rejected",
    "Completed",
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getStockRequests();
      setRequests(res);
    } catch (err) {
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [requests, searchTerm, selectedCategory]);

  const filterProducts = () => {
    let filtered = requests;

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.fromAssistantEmail
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          item.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== "All") {
      filtered = filtered.filter((item) => item.status === selectedCategory);
    }

    setFilteredRequests(filtered);
  };

  const handleViewRequestClick = async (id) => {
    try {
      setModalLoading(true);
      setViewRequestModal({ open: true, req: null });

      const req = await getStockRequestDetails(id);
      setViewRequestModal({ open: true, req });
    } catch (err) {
      toast.error("Error loading the request");
    } finally {
      setModalLoading(false);
    }
  };

  // Show confirmation modal for delete action
  const showDeleteConfirmation = (req) => {
    setConfirmationModal({
      open: true,
      type: "delete",
      req: req,
      message: t("stockRequests.deleteMessage", {
        email: req.fromAssistantEmail || t("stockRequests.unknownSupplier"),
      }),
    });
  };

  const handleDelete = async () => {
    if (!confirmationModal.req) return;

    try {
      await deleteStockRequest(confirmationModal.req._id);
      fetchData();
      setConfirmationModal({ open: false, type: "", req: null, message: "" });
    } catch (err) {
      toast.error("Error deleting request");
      setConfirmationModal({ open: false, type: "", req: null, message: "" });
    }
  };

  const handleReceive = () => {
    alert("Mark as receive");
  };

  const handleQuantityChange = (requestId, itemId, newQuantity) => {
    setViewRequestModal((prev) => ({
      ...prev,
      req: {
        ...prev.req,
        items: prev.req.items.map((i) =>
          i.item._id === itemId ? { ...i, approvedQuantity: newQuantity } : i
        ),
      },
    }));
  };

  if (loading)
    return (
      <div className="requestsTab-loading">
        <div className="requestsTab-spinner"></div>
        <p>{t("stockRequests.loading")}</p>
      </div>
    );

  return (
    <div className="requestsTab-container">
      {/* Header Section */}
      <div className="requestsTab-header">
        <div className="requestsTab-headerContent">
          <div className="requestsTab-titleSection">
            <div className="requestsTab-iconWrapper">
              <FiFilePlus size={24} />
            </div>
            <div>
              <h1>{t("stockRequests.title")}</h1>
              <p>{t("stockRequests.subtitle")}</p>
            </div>
          </div>
          <button className="requestsTab-refreshBtn" onClick={fetchData}>
            <FiRefreshCcw size={18} /> {t("stockRequests.refresh")}
          </button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="requestsTab-searchSection">
        <SearchBar
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t("stockRequests.searchPlaceholder")}
        />
        <div className="requestsTab-filterControls">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="requestsTab-categoryFilter"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === "All" ? t("stockRequests.allRequests") : category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="requestsTab-requestsSection">
        <div className="requestsTab-sectionHeader">
          <h3>
            {t("stockRequests.requestsSection")} ({filteredRequests.length})
          </h3>
          <span className="requestsTab-subtitle">
            {t("stockRequests.allRequests")}
          </span>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="requestsTab-emptyState">
            <FiPackage size={64} />
            <h4>{t("stockRequests.noRequests")}</h4>
          </div>
        ) : (
          <div className="requestsTab-tableContainer">
            <table className="requestsTab-table">
              <thead>
                <tr>
                  <th>{t("stockRequests.assistant")}</th>
                  <th>{t("stockRequests.date")}</th>
                  <th>{t("stockRequests.status")}</th>
                  <th>{t("stockRequests.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req._id} className="requestsTab-tableRow">
                    <td className="requestsTab-productName">
                      <strong>{req.fromAssistantEmail}</strong>
                    </td>
                    <td>
                      <FiCalendar size={14} />{" "}
                      {new Date(req.requestedDate).toLocaleDateString()}
                    </td>
                    <td>
                      <span
                        className={`requestsTab-categoryBadge requestsTab-category-${req.status
                          .toLowerCase()
                          .replace(" ", "-")}`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="requestsTab-actionButtons">
                      <button
                        className="requestsTab-viewItemsBtn"
                        onClick={() => handleViewRequestClick(req._id)}
                        title={t("stockRequests.requestDetails")}
                      >
                        <FiEye />
                      </button>
                      <button
                        className="requestsTab-deleteBtn"
                        onClick={() => showDeleteConfirmation(req)}
                        title={t("stockRequests.confirmDeletion")}
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modern View Items Modal */}
      {viewRequestModal.open && createPortal(
        <div className="requestsTab-modalOverlay">
          <div className="requestsTab-modal requestsTab-modernModal">
            {modalLoading && (
              <div className="requestsTab-loading">
                <div className="requestsTab-spinner"></div>
                <p>{t("stockRequests.loading")}</p>
              </div>
            )}

            {!modalLoading && viewRequestModal.req && (
              <>
                {/* Header */}
                <div className="requestsTab-modalHeader modern-header">
                  <div className="modern-headerContent">
                    <div className="modern-headerMain">
                      <div className="modern-orderBadge">
                        <FiPackage size={20} />
                      </div>
                      <div className="modern-headerData">
                        <div className="modern-headerText">
                          <h3>{t("stockRequests.requestDetails")}</h3>
                          <p className="modern-orderSupplier">
                            {t("stockRequests.assistantLabel")}{" "}
                            <span className="modern-supplierName">
                              {viewRequestModal.req.assistantName ||
                                t("stockRequests.unknownAssistant")}
                            </span>
                          </p>
                        </div>
                        <div className="modern-headerMeta">
                          <div className="modern-metaItem">
                            <span className="modern-metaLabel">
                              {t("stockRequests.requestDate")}
                            </span>
                            <span className="modern-metaValue">
                              {new Date(
                                viewRequestModal.req.requestedDate
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    className="requestsTab-closeBtn modern-closeBtn"
                    onClick={() =>
                      setViewRequestModal({ open: false, req: null })
                    }
                  >
                    <FiX size={20} />
                  </button>
                </div>

                {/* Supplier Info Card */}
                <div className="modern-supplierCard">
                  <div className="modern-supplierInfo">
                    <div className="modern-contactItem">
                      <FiUser size={16} />
                      <span>
                        {viewRequestModal.req.assistantName ||
                          t("stockRequests.noContactPerson")}
                      </span>
                    </div>
                    <div className="modern-contactItem">
                      <FiPhone size={16} />
                      <span>
                        {viewRequestModal.req.assistant?.phoneNumber ||
                          t("stockRequests.noPhone")}
                      </span>
                    </div>
                    <div className="modern-contactItem">
                      <FiMail size={16} />
                      <span>
                        {viewRequestModal.req.assistant?.email ||
                          t("stockRequests.noEmail")}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`modern-statusBadge modern-status-${viewRequestModal.req.status.toLowerCase()}`}
                  >
                    {viewRequestModal.req.status}
                  </div>
                </div>

                {/* Items Section */}
                <div className="modern-itemsSection">
                  {/* Controls */}
                  <div className="modern-controls">
                    {viewRequestModal.req.items.every(
                      (i) => i.itemStatus === "Approved"
                    ) ? (
                      <div className="modern-completeNotice">
                        <div className="modern-completeIcon">
                          <FiCheckSquare size={20} />
                        </div>
                        <div className="modern-completeText">
                          <span className="modern-completeTitle">
                            {t("stockRequests.requestApproved")}
                          </span>
                          <span className="modern-completeSubtitle">
                            {t("stockRequests.allItemsApproved")}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="modern-actionControls">
                        <label className="modern-selectAll">
                          <div className="modern-checkbox">
                            <input
                              type="checkbox"
                              checked={viewRequestModal.req.items.every(
                                (i) =>
                                  i.itemStatus === "Approved" || i._selected
                              )}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                const updatedRequest = {
                                  ...viewRequestModal.req,
                                  items: viewRequestModal.req.items.map(
                                    (item) => ({
                                      ...item,
                                      _selected: isChecked,
                                    })
                                  ),
                                };
                                setViewRequestModal((prev) => ({
                                  ...prev,
                                  req: updatedRequest,
                                }));
                              }}
                            />
                            <span className="modern-checkmark"></span>
                          </div>
                          {t("stockRequests.selectAllItems")}
                        </label>

                        <button
                          className="modern-markReceivedBtn"
                          onClick={async () => {
                            const selectedItems =
                              viewRequestModal.req.items.filter(
                                (i) =>
                                  i._selected && i.itemStatus !== "Approved"
                              );

                            if (selectedItems.length === 0) {
                              toast.info(t("stockRequests.selectItemsPrompt"));
                              return;
                            }

                            const updatedItems = [
                              ...viewRequestModal.req.items,
                            ];

                            for (const item of selectedItems) {
                              await updateStockRequestItemStatus(
                                viewRequestModal.req._id,
                                item._id,
                                {
                                  status: "Approved",
                                  approvedQuantity: item.approvedQuantity,
                                }
                              );

                              const idx = updatedItems.findIndex(
                                (i) => i._id === item._id
                              );
                              if (idx !== -1) {
                                updatedItems[idx].itemStatus = "Approved";
                                updatedItems[idx]._selected = false;
                              }
                            }

                            const allReceived = updatedItems.every(
                              (i) => i.itemStatus === "Approved"
                            );

                            setViewRequestModal((prev) => ({
                              ...prev,
                              req: {
                                ...prev.req,
                                status: allReceived
                                  ? "Approved"
                                  : prev.req.status,
                                items: updatedItems,
                              },
                            }));

                            fetchData();
                            handleViewRequestClick(viewRequestModal.req._id);
                          }}
                        >
                          <FiCheckSquare size={16} />
                          {t("stockRequests.markSelectedApproved")}
                          <span className="modern-badge">
                            {
                              viewRequestModal.req.items.filter(
                                (i) =>
                                  i._selected && i.itemStatus !== "Approved"
                              ).length
                            }
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Items Table */}
                  <div className="modern-tableContainer">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th className="modern-th-checkbox">
                            <div className="modern-checkbox">
                              <input
                                type="checkbox"
                                checked={viewRequestModal.req.items.every(
                                  (i) => i._selected
                                )}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  const updatedOrder = {
                                    ...viewRequestModal.req,
                                    items: viewRequestModal.req.items.map(
                                      (item) => ({
                                        ...item,
                                        _selected: isChecked,
                                      })
                                    ),
                                  };
                                  setViewRequestModal((prev) => ({
                                    ...prev,
                                    req: updatedOrder,
                                  }));
                                }}
                                disabled={
                                  viewRequestModal.req.status === "Approved"
                                }
                              />
                              <span className="modern-checkmark"></span>
                            </div>
                          </th>
                          <th className="modern-th-number">#</th>
                          <th className="modern-th-product">
                            {t("stockRequests.product")}
                          </th>
                          <th className="modern-th-category">
                            {t("stockRequests.category")}
                          </th>
                          <th className="modern-th-quantity">
                            {t("stockRequests.quantity")}
                          </th>
                          <th className="modern-th-approved-quantity">
                            {t("stockRequests.approvedQuantity")}
                          </th>
                          <th className="modern-th-quantity">
                            {t("stockRequests.availableQuantity")}
                          </th>
                          <th className="modern-th-status">
                            {t("stockRequests.status")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewRequestModal.req.items.map((item, idx) => (
                          <tr
                            key={item._id}
                            className={`modern-tableRow
                          ${
                            item.itemStatus === "Approved"
                              ? "modern-rowReceived"
                              : ""
                          }
                          ${
                            item.itemStatus !== "Approved" &&
                            item.requestedQuantity > item.availableQuantity
                              ? "modern-rowLowStock"
                              : ""
                          }
                        `}
                          >
                            <td className="modern-td-checkbox">
                              <div className="modern-checkbox">
                                <input
                                  type="checkbox"
                                  checked={!!item._selected}
                                  onChange={(e) => {
                                    const updatedItems =
                                      viewRequestModal.req.items.map((i) =>
                                        i._id === item._id
                                          ? {
                                              ...i,
                                              _selected: e.target.checked,
                                            }
                                          : i
                                      );
                                    setViewRequestModal((prev) => ({
                                      ...prev,
                                      req: { ...prev.req, items: updatedItems },
                                    }));
                                  }}
                                  disabled={item.itemStatus === "Approved"}
                                />
                                <span className="modern-checkmark"></span>
                              </div>
                            </td>
                            <td className="modern-td-number">
                              <span className="modern-itemNumber">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="modern-td-product">
                              <div className="modern-productInfo">
                                <span className="modern-productName">
                                  {item.item?.name || "—"}
                                </span>
                                {item.availableQuantity <
                                  item.requestedQuantity &&
                                  item.itemStatus !== "Approved" && (
                                    <span className="modern-error-text">
                                      {t("stockRequests.notEnoughStock")}
                                    </span>
                                  )}
                              </div>
                            </td>
                            <td className="modern-td-category">
                              <span className="modern-categoryBadge">
                                {item.item?.category || "—"}
                              </span>
                            </td>
                            <td className="modern-td-quantity">
                              <span className="modern-quantity">
                                {item.requestedQuantity}
                              </span>
                            </td>
                            <td className="modern-td-approved-quantity">
                              {editingItemId === item.item._id ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={Math.min(
                                    item.requestedQuantity,
                                    item.availableQuantity
                                  )}
                                  value={item.approvedQuantity}
                                  onChange={(e) => {
                                    let value = Number(e.target.value);
                                    if (value < 0) value = 0;
                                    if (
                                      value >
                                      Math.min(
                                        item.requestedQuantity,
                                        item.availableQuantity
                                      )
                                    ) {
                                      value = Math.min(
                                        item.requestedQuantity,
                                        item.availableQuantity
                                      );
                                    }
                                    handleQuantityChange(
                                      viewRequestModal.req._id,
                                      item.item._id,
                                      value
                                    );
                                  }}
                                  onBlur={() => setEditingItemId(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      setEditingItemId(null);
                                  }}
                                  className="modern-quantity-input"
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <span className="modern-quantity">
                                    {item.approvedQuantity}
                                  </span>
                                  <button
                                    className="modern-td-approved-quantity-editBtn"
                                    onClick={() => {
                                      if (item.itemStatus !== "Approved") {
                                        setEditingItemId(item.item._id);
                                      }
                                    }}
                                    title={
                                      item.itemStatus !== "Approved"
                                        ? t(
                                            "stockRequests.editApprovedQuantity"
                                          )
                                        : t("stockRequests.alreadyApproved")
                                    }
                                  >
                                    <FiEdit2 size={14} />
                                  </button>
                                </>
                              )}
                            </td>
                            <td className="modern-td-quantity">
                              <span className="modern-quantity">
                                {item.availableQuantity}
                              </span>
                            </td>
                            <td className="modern-td-status">
                              <div
                                className={`modern-statusIndicator modern-status-${
                                  item.itemStatus?.toLowerCase() || "pending"
                                }`}
                              >
                                <div className="modern-statusDot"></div>
                                <span>
                                  {item.itemStatus ||
                                    t("stockRequests.itemStatuses.pending")}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="modern-summary">
                    <div className="modern-summaryContent">
                      <div className="modern-summaryItem">
                        <span className="modern-summaryLabel">
                          {t("stockRequests.itemsTotal")}
                        </span>
                        <span className="modern-summaryValue">
                          {viewRequestModal.req.items.length}{" "}
                          {t("stockRequests.itemsCount")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      , document.body)}

      {/* Confirmation Modal */}
      {confirmationModal.open && createPortal(
        <div className="requestsTab-modalOverlay">
          <div className="requestsTab-confirmationModal">
            <div className="requestsTab-confirmationHeader">
              <div className="requestsTab-confirmationIcon">
                <FiAlertTriangle size={24} />
              </div>
              <h3>
                {confirmationModal.type === "receive"
                  ? t("stockRequests.confirmReceipt")
                  : t("stockRequests.confirmDeletion")}
              </h3>
              <button
                className="requestsTab-closeBtn"
                onClick={() =>
                  setConfirmationModal({
                    open: false,
                    type: "",
                    order: null,
                    message: "",
                  })
                }
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="requestsTab-confirmationContent">
              <p>{confirmationModal.message}</p>

              {confirmationModal.req && (
                <div className="requestsTab-confirmationDetails">
                  <div>
                    <strong>{t("stockRequests.assistant")}:</strong>{" "}
                    {confirmationModal.req.fromAssistantEmail ||
                      t("stockRequests.unknownAssistant")}
                  </div>
                  <div>
                    <strong>{t("stockRequests.requestDate")}</strong>{" "}
                    {new Date(
                      confirmationModal.req.requestedDate
                    ).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>

            <div className="requestsTab-confirmationActions">
              <button
                className="requestsTab-cancelConfirmBtn"
                onClick={() =>
                  setConfirmationModal({
                    open: false,
                    type: "",
                    order: null,
                    message: "",
                  })
                }
              >
                {t("stockRequests.cancel")}
              </button>
              <button
                className={
                  confirmationModal.type === "receive"
                    ? "requestsTab-confirmReceiveBtn"
                    : "requestsTab-confirmDeleteBtn"
                }
                onClick={
                  confirmationModal.type === "receive"
                    ? handleReceive
                    : handleDelete
                }
              >
                {confirmationModal.type === "receive"
                  ? t("stockRequests.markAsReceived")
                  : t("stockRequests.deleteRequest")}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};
export default StockRequestsTab;
