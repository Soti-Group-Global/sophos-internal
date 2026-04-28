import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
  FiPlus, FiX, FiTrash2, FiPackage, FiTruck, FiRefreshCcw, FiEdit, FiFilePlus, FiSearch, 
  FiCalendar, FiCheckSquare, FiEye, FiUser, FiPhone, FiMail, FiEdit2, FiAlertTriangle
} from "react-icons/fi";
import { deleteStockRequest, getEmailFromToken, getInventoryItems, getAssistantStockRequest, getStockRequestsByAssistant, sendStockRequest } from "../utils/api";
import { useTranslation } from "react-i18next";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import "../styles/StockRequestsTab.css";
import "../styles/StockRequest.css";

const StockRequest = () => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
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
  
  const [showModal, setShowModal] = useState(false);
  const openModal = () => { document.body.classList.add("modal-open"); setShowModal(true); };
  const closeModal = () => { document.body.classList.remove("modal-open"); setShowModal(false); };

  const openViewModal = (val) => { document.body.classList.add("modal-open"); setViewRequestModal(val); };
  const closeViewModal = () => { document.body.classList.remove("modal-open"); setViewRequestModal({ open: false, req: null }); };

  const openConfirmModal = (val) => { document.body.classList.add("modal-open"); setConfirmationModal(val); };
  const closeConfirmModal = () => { document.body.classList.remove("modal-open"); setConfirmationModal({ open: false, type: "", req: null, message: "" }); };
  const [inventoryItems, setInventoryItems] = useState([]);
  const [formData, setFormData] = useState({
    items: [],
  });
  
  const categories = [
    { value: "All", label: t("stockRequest.categories.all") },
    { value: "Pending", label: t("stockRequest.categories.pending") },
    { value: "Partially Approved", label: t("stockRequest.categories.partiallyApproved") },
    { value: "Approved", label: t("stockRequest.categories.approved") },
    { value: "Rejected", label: t("stockRequest.categories.rejected") },
    { value: "Completed", label: t("stockRequest.categories.completed") },
  ];
  const assistantEmail = getEmailFromToken();
  
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getStockRequestsByAssistant(assistantEmail);
      const inventoryItemsData = await getInventoryItems();

      setInventoryItems(inventoryItemsData);
      setRequests(res);
    } catch(err) {
      console.error(err);
      toast.error(t('stockRequest.toast.fetchError'))
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [])

  useEffect(() => {
    filterRequests();
  }, [requests, selectedCategory]);
    
  const filterRequests = () => {
    let filtered = requests;
    
    if (selectedCategory !== "All") {
      filtered = filtered.filter(item => item.status === selectedCategory);
    }
    
    setFilteredRequests(filtered);
  };

  const handleViewRequestClick = async (id) => {
    try {
      setModalLoading(true);
      openViewModal({ open: true, req: null })

      const req = await getAssistantStockRequest(id);
      openViewModal({ open: true, req })
    } catch (err) {
      console.error(err);
      toast.error(t("stockRequest.toast.loadError"));
    } finally {
      setModalLoading(false);
    }
  }

  // Show confirmation modal for delete action
  const showDeleteConfirmation = (req) => {
    openConfirmModal({
      open: true,
      type: "delete",
      req: req,
      message: t("stockRequest.confirmModal.deleteMessage"),
    });
  };

  
  const handleDelete = async () => {
    if (!confirmationModal.req) return;
    
    try {
      await deleteStockRequest(confirmationModal.req._id);
      fetchData();
      closeConfirmModal();
    } catch (err) {
      console.error(err);
      toast.error(t("stockRequest.toast.deleteError"));
      closeConfirmModal();
    }
  };
  
  const handleReceive = () => {
    alert('Mark as receive');
  }

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { item: "", requestedQuantity: 1 },
      ],
    });
  };

  const handleRemoveItem = (index) => {
    const updated = [...formData.items];
    updated.splice(index, 1);
    setFormData({ ...formData, items: updated });
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...formData.items];

    if(field === "item") {
      updated[index][field] = value;
    }else if(field === "requestedQuantity") {
      updated[index][field] = Number(value);
    }

    setFormData({ ...formData, items: updated });
  };

  const resetForm = () => {
    setFormData({ items: [] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      toast.error(t("stockRequest.toast.emptyItems"));
      return;
    }

    try {
      await sendStockRequest(assistantEmail, formData);
      toast.success(t("stockRequest.toast.submitSuccess"))
      fetchData();
      closeModal();
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error(t("stockRequest.toast.submitError"));
    }
  };

  if (loading)
    return (
      <div className="requestsTab-loading">
        <div className="requestsTab-spinner"></div>
        <p>{t("stockRequest.loading")}</p>
      </div>
    );

  return (
    <div className="stock-request-container">
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="stock-request-content">

        {/* Header */}
        <div className="stock-request-header">
          <div className="stock-request-headerContent">
            <div className="stock-request-titleSection">
              <div className="stock-request-iconWrapper">
                <FiPackage size={24} />
              </div>
              <div>
                <h1>{t("stockRequest.pageTitle")}</h1>
                {/* <p>Manage multi-supplier inventory purchases</p> */}
              </div>
            </div>
            <button
              className="stock-request-btn"
              onClick={() => openModal()}
            >
              <FiPlus size={18} /> {t("stockRequest.requestItems")}
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="requestsTab-searchSection">
          <h4>{t("stockRequest.filterByStatus")}</h4>
        <div className="requestsTab-filterControls">
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="requestsTab-categoryFilter"
          >
            {categories.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="requestsTab-requestsSection">
        <div className="requestsTab-sectionHeader">
          <h3>{t("stockRequest.listTitle")} ({filteredRequests.length})</h3>
          <span className="requestsTab-subtitle">{t("stockRequest.listSubtitle")}</span>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="requestsTab-emptyState">
            <FiPackage size={64} />
            <h4>{t("stockRequest.noRequests")}</h4>
          </div>
        ) : (
          <div className="requestsTab-tableContainer">
            <table className="requestsTab-table">
              <thead>
                <tr>
                  <th>{t("stockRequest.table.requestDate")}</th>
                  <th>{t("stockRequest.table.status")}</th>
                  <th>{t("stockRequest.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req._id} className="requestsTab-tableRow">
                    <td>
                        <FiCalendar size={14} />{" "}
                        {new Date(req.requestedDate).toLocaleDateString()}
                      </td>
                    <td>
                      <span className={`requestsTab-categoryBadge requestsTab-category-${req.status.toLowerCase().replace(' ', '-')}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="requestsTab-actionButtons">
                      <button
                        className="requestsTab-viewItemsBtn"
                        onClick={() =>
                          handleViewRequestClick(req._id)
                        }
                        title={t("stockRequest.table.viewTitle")}
                      >
                        <FiEye />
                      </button>
                      {/* {req.status !== "Completed" && (
                        <button
                          className="requestsTab-receiveBtn"
                          // onClick={() => showReceiveConfirmation(req)}
                          title="Approve items"
                        >
                          <FiCheckSquare />
                        </button>
                      )} */}
                      <button
                        className="requestsTab-deleteBtn"
                        onClick={() => showDeleteConfirmation(req)}
                        title={t("stockRequest.table.deleteTitle")}
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
      {viewRequestModal.open && ReactDOM.createPortal(
        <div className="requestsTab-modalOverlay" onClick={closeViewModal}>
          <div className="requestsTab-modal requestsTab-modernModal" onClick={(e) => e.stopPropagation()}>
            {modalLoading && (
              <div className="requestsTab-loading">
                <div className="requestsTab-spinner"></div>
                <p>{t("stockRequest.loadingRequest")}</p>
              </div>
            )}

            {(!modalLoading && viewRequestModal.req) && (
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
                      <h3>{t("stockRequest.viewModal.title")}</h3>
                      <p className="modern-orderSupplier">
                        {t("stockRequest.viewModal.requestDate")}:{" "}
                        <span className="modern-metaValue">
                          {new Date(
                            viewRequestModal.req.requestedDate
                          ).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <button
                className="requestsTab-closeBtn modern-closeBtn"
                onClick={closeViewModal}
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Info Card */}
            <div className="modern-supplierCard">
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
                ) && (
                  <div className="modern-completeNotice">
                    <div className="modern-completeIcon">
                      <FiCheckSquare size={20} />
                    </div>
                    <div className="modern-completeText">
                      <span className="modern-completeTitle">
                        {t("stockRequest.viewModal.allApprovedTitle")}
                      </span>
                      <span className="modern-completeSubtitle">
                        {t("stockRequest.viewModal.allApprovedSubtitle")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="modern-tableContainer">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th className="modern-th-number">{t("stockRequest.viewModal.colNumber")}</th>
                      <th className="modern-th-product">{t("stockRequest.viewModal.colProduct")}</th>
                      <th className="modern-th-category">{t("stockRequest.viewModal.colCategory")}</th>
                      <th className="modern-th-quantity">{t("stockRequest.viewModal.colQty")}</th>
                      <th className="modern-th-quantity">{t("stockRequest.viewModal.colApprovedQty")}</th>
                      <th className="modern-th-status">{t("stockRequest.viewModal.colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewRequestModal.req.items
                    .map((item, idx) => (
                      <tr
                        key={item._id}
                        className={`modern-tableRow
                          ${item.itemStatus === "Approved" ? "modern-rowReceived" : ""}
                        `}
                      >
                        <td className="modern-td-number">
                          <span className="modern-itemNumber">{idx + 1}</span>
                        </td>
                        <td className="modern-td-product">
                          <div className="modern-productInfo">
                            <span className="modern-productName">
                              {item.item?.name || "—"}
                            </span>
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
                        <td className="modern-td-quantity">
                          <span className="modern-quantity">
                            {item.itemStatus?.toLowerCase() === 'approved' ? item.approvedQuantity : "-"}
                          </span>
                        </td>
                        <td className="modern-td-status">
                          <div
                            className={`modern-statusIndicator modern-status-${
                              item.itemStatus?.toLowerCase() || "pending"
                            }`}
                          >
                            <div className="modern-statusDot"></div>
                            <span>{item.itemStatus || t("stockRequest.viewModal.statusPending")}</span>
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
                    <span className="modern-summaryLabel">{t("stockRequest.viewModal.itemsTotal")}</span>
                    <span className="modern-summaryValue">
                      {viewRequestModal.req.items.length} {t("stockRequest.viewModal.items")}
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
      {confirmationModal.open && (
        <div className="requestsTab-modalOverlay">
          <div className="requestsTab-confirmationModal">
            <div className="requestsTab-confirmationHeader">
              <div className="requestsTab-confirmationIcon">
                <FiAlertTriangle size={24} />
              </div>
              <h3>
                {confirmationModal.type === "receive"
                  ? t("stockRequest.confirmModal.receiveTitle")
                  : t("stockRequest.confirmModal.deleteTitle")}
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
                    <strong>{t("stockRequest.confirmModal.assistantEmail")}:</strong>{" "}
                    {confirmationModal.req.fromAssistantEmail || t("stockRequest.confirmModal.unknown")}
                  </div>
                  <div>
                    <strong>{t("stockRequest.confirmModal.requestDate")}:</strong>{" "}
                    {new Date(
                      confirmationModal.req.requestedDate
                    ).toLocaleDateString()}
                  </div>
                  {/* <div>
                    <strong>Total Amount:</strong> ₹
                    {confirmationModal.order.totalAmount?.toFixed(2) || "0.00"}
                  </div> */}
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
                {t("stockRequest.confirmModal.cancel")}
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
                  ? t("stockRequest.confirmModal.confirmReceive")
                  : t("stockRequest.confirmModal.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Stock Modal */}
      {showModal && ReactDOM.createPortal(
        <div className="stock-request-modalOverlay" onClick={closeModal}>
          <div className="stock-request-modal" onClick={(e) => e.stopPropagation()}>
            <div className="stock-request-modalHeader">
              <h3>{t("stockRequest.form.title")}</h3>
              <button
                className="stock-request-closeBtn"
                onClick={() => {
                  closeModal();
                  resetForm();
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="stock-request-form">

              <div className="stock-request-itemsSection">
                <h4>{t("stockRequest.form.selectItems")}</h4>
                {formData.items.length === 0 ? (
                  <div className="stock-request-emptyState">
                    <div className="stock-request-emptyContent">
                      <FiPackage size={48} className="stock-request-emptyIcon" />
                      <h4>{t("stockRequest.form.noItemsTitle")}</h4>
                      <p>{t("stockRequest.form.noItemsHint")}</p>
                      <button
                        type="button"
                        className="stock-request-addFirstBtn"
                        onClick={handleAddItem}
                      >
                        <FiPlus /> {t("stockRequest.form.addFirstProduct")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="stock-request-itemsList">
                    {/* Table Header */}
                    <div className="stock-request-itemHeader">
                      <div>{t("stockRequest.form.colProduct")}</div>
                      <div>{t("stockRequest.form.colQuantity")}</div>
                      <div>{t("stockRequest.form.colAction")}</div>
                    </div>

                    {/* Item Rows */}
                    {formData.items.map((entry, index) => (
                      <div className="stock-request-itemRow" key={index}>
                        {/* Product First */}
                        <div className="stock-request-formGroup">
                          <select
                            value={entry.item}
                            onChange={(e) =>
                              handleItemChange(index, "item", e.target.value)
                            }
                            required
                          >
                            <option value="">{t("stockRequest.form.selectProduct")}</option>
                            {inventoryItems
                              .filter(
                                (item, idx, arr) =>
                                  arr.findIndex(
                                    (new_item) => new_item._id === item._id
                                  ) === idx
                              )
                              .map((item) => (
                                <option key={item._id} value={item._id}>
                                  {item.name} -{" "}
                                  {item.category || t("stockRequest.form.uncategorized")}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* requestedQuantity */}
                        <div className="stock-request-formGroup">
                          <input
                            type="number"
                            min="1"
                            value={entry.requestedQuantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "requestedQuantity",
                                e.target.value
                              )
                            }
                            required
                          />
                        </div>

                        {/* Remove Button */}
                        <div className="stock-request-formGroup">
                          <button
                            type="button"
                            className="stock-request-removeItemBtn"
                            onClick={() => handleRemoveItem(index)}
                            title={t("stockRequest.form.removeItemTitle")}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Regular Add Item Button - Only show when items exist */}
              {formData.items.length > 0 && (
                <button
                  type="button"
                  className="stock-request-addItemBtn"
                  onClick={handleAddItem}
                >
                  <FiPlus /> {t("stockRequest.form.addAnotherItem")}
                </button>
              )}

              {formData.items.length > 0 && (
                <div className="stock-request-formActions">
                  <div className="stock-request-actionButtons">
                    <button
                      type="button"
                      className="stock-request-cancelBtn"
                      onClick={() => {
                        closeModal();
                        resetForm();
                      }}
                    >
                      {t("stockRequest.form.cancel")}
                    </button>
                    <button type="submit" className="stock-request-saveBtn">
                      {t("stockRequest.form.submit")}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      , document.body)}

    </div>
  )
}

export default StockRequest;