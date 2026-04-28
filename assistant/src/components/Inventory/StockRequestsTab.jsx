import { FiRefreshCcw, FiPackage, FiEdit, FiFilePlus, FiSearch, FiTrash2, FiCalendar, FiCheckSquare, FiEye, FiX, FiUser, FiPhone, FiMail, FiEdit2, FiAlertTriangle } from "react-icons/fi";
import "../../styles/StockRequestsTab.css"
import { useEffect, useState } from "react";
import { deleteStockRequest, getStockRequestDetails, getStockRequests, updateStockRequestItemStatus } from "../../utils/api";
import { toast } from "react-toastify";

const StockRequestsTab = () => {
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

  const categories = ["All", "Pending", "Partially Approved", "Approved", "Rejected", "Completed"];

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getStockRequests();
      setRequests(res);
    } catch(err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [])

  useEffect(() => {
    filterProducts();
  }, [requests, searchTerm, selectedCategory]);
  
  const filterProducts = () => {
    let filtered = requests;
    
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.fromAssistantEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory !== "All") {
      filtered = filtered.filter(item => item.status === selectedCategory);
    }
    
    setFilteredRequests(filtered);
  };

  const handleViewRequestClick = async (id) => {
    try {
      setModalLoading(true);
      setViewRequestModal({ open: true, req: null })

      const req = await getStockRequestDetails(id);
      // const updatedItems = req.items.map((item) => ({
      //   ...item,
      //   approvedQuantity: item.requestedQuantity,
      // }));

      // setViewRequestModal({ open: true, req: {...req, items: updatedItems} })
      setViewRequestModal({ open: true, req })
    } catch (err) {
      console.error(err);
      toast.error("Error loading the request");
    } finally {
      setModalLoading(false);
    }
  }

  // Show confirmation modal for delete action
  const showDeleteConfirmation = (req) => {
    setConfirmationModal({
      open: true,
      type: "delete",
      req: req,
      message: `Are you sure you want to delete the request from ${
        req.fromAssistantEmail || "Unknown Supplier"
      }? This action cannot be undone and all request data will be permanently lost.`,
    });
  };

  const handleDelete = async () => {
    if (!confirmationModal.req) return;

    try {
      await deleteStockRequest(confirmationModal.req._id);
      fetchData();
      setConfirmationModal({ open: false, type: "", req: null, message: "" });
      // toast.success("Request deleted successfully !");
    } catch (err) {
      console.error(err);
      toast.error("Error deleting request");
      setConfirmationModal({ open: false, type: "", req: null, message: "" });
    }
  };

  const handleReceive = () => {
    alert('Mark as receive');
  }

  const handleQuantityChange = (requestId, itemId, newQuantity) => {
  // setRequests((prevRequests) =>
  //   prevRequests.map((req) =>
  //     req._id === requestId
  //       ? {
  //           ...req,
  //           items: req.items.map((i) =>
  //             i.item._id === itemId
  //               ? { ...i, requestedQuantity: Number(newQuantity) }
  //               : i
  //           ),
  //         }
  //       : req
  //   )
  // );

  // Update the currently viewed modal
  setViewRequestModal((prev) => ({
    ...prev,
    req: {
      ...prev.req,
      items: prev.req.items.map((i) =>
        i.item._id === itemId
          ? { ...i, approvedQuantity: newQuantity }
          : i
      ),
    },
  }));
};

  if (loading)
    return (
      <div className="requestsTab-loading">
        <div className="requestsTab-spinner"></div>
        <p>Loading Stock Requests...</p>
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
              <h1>Stock Requests Management</h1>
              <p>Manage requests for inventory stock</p>
            </div>
          </div>
          <button
            className="requestsTab-refreshBtn"
            onClick={fetchData}
          >
            <FiRefreshCcw size={18} /> Refresh
          </button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="requestsTab-searchSection">
        <div className="requestsTab-searchBox">
          <FiSearch className="requestsTab-searchIcon" />
          <input
            type="text"
            placeholder="Search by assistant or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="requestsTab-filterControls">
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="requestsTab-categoryFilter"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="requestsTab-requestsSection">
        <div className="requestsTab-sectionHeader">
          <h3>Requests for Stock ({filteredRequests.length})</h3>
          <span className="requestsTab-subtitle">All stock requests by assistants</span>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="requestsTab-emptyState">
            <FiPackage size={64} />
            <h4>No Stock Requests to Show</h4>
          </div>
        ) : (
          <div className="requestsTab-tableContainer">
            <table className="requestsTab-table">
              <thead>
                <tr>
                  <th>Assistant</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req._id} className="requestsTab-tableRow">
                    <td className="requestsTab-productName">
                      <strong>{req.fromAssistantEmail}</strong>
                      {/* {product.description && (
                        <span className="requestsTab-productDescription">{product.description}</span>
                      )} */}
                    </td> 
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
                        title="View request"
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
                        title="Delete request"
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
      {viewRequestModal.open && (
        <div className="requestsTab-modalOverlay">
          <div className="requestsTab-modal requestsTab-modernModal">
            {modalLoading && (
              <div className="requestsTab-loading">
                <div className="requestsTab-spinner"></div>
                <p>Loading Stock Request...</p>
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
                      <h3>Stock Request Details</h3>
                      <p className="modern-orderSupplier">
                        Assistant:{" "}
                        <span className="modern-supplierName">
                          {viewRequestModal.req.assistantName ||
                            "Unknown Assistant"}
                        </span>
                      </p>
                    </div>
                    <div className="modern-headerMeta">
                      {/* <div className="modern-metaItem">
                        <span className="modern-metaLabel">PO Number:</span>
                        <span className="modern-metaValue">
                          #{viewRequestModal.req._id?.slice(-8).toUpperCase()}
                        </span>
                      </div> */}
                      <div className="modern-metaItem">
                        <span className="modern-metaLabel">Request Date:</span>
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
                onClick={() => setViewRequestModal({ open: false, req: null })}
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
                      "No contact person"}
                  </span>
                </div>
                <div className="modern-contactItem">
                  <FiPhone size={16} />
                  <span>
                    {viewRequestModal.req.assistant?.phoneNumber || "No phone"}
                  </span>
                </div>
                <div className="modern-contactItem">
                  <FiMail size={16} />
                  <span>
                    {viewRequestModal.req.assistant?.email || "No email"}
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
                        Request Approved
                      </span>
                      <span className="modern-completeSubtitle">
                        All items have been approved
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
                            (i) => i.itemStatus === "Approved" || i._selected
                          )}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            const updatedRequest = {
                              ...viewRequestModal.req,
                              items: viewRequestModal.req.items.map((item) => ({
                                ...item,
                                _selected: isChecked,
                              })),
                            };
                            setViewRequestModal((prev) => ({
                              ...prev,
                              req: updatedRequest,
                            }));
                          }}
                        />
                        <span className="modern-checkmark"></span>
                      </div>
                      Select All Items
                    </label>

                    <button
                      className="modern-markReceivedBtn"
                      onClick={async () => {
                        const selectedItems = viewRequestModal.req.items.filter(
                          (i) => i._selected && i.itemStatus !== "Approved"
                        );

                        if (selectedItems.length === 0) {
                          toast.info(
                            "Please select at least one product to mark as approved."
                          );
                          return;
                        }

                        const updatedItems = [...viewRequestModal.req.items];

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
                      Mark Selected as Approved
                      <span className="modern-badge">
                        {
                          viewRequestModal.req.items.filter(
                            (i) => i._selected && i.itemStatus !== "Approved"
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
                            disabled={viewRequestModal.req.status === 'Approved'}
                          />
                          <span className="modern-checkmark"></span>
                        </div>
                      </th>
                      <th className="modern-th-number">#</th>
                      <th className="modern-th-product">Product</th>
                      <th className="modern-th-category">Category</th>
                      <th className="modern-th-quantity">Qty</th>
                      <th className="modern-th-approved-quantity">Approved Qty</th>
                      <th className="modern-th-quantity">Available Qty</th>
                      <th className="modern-th-status">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewRequestModal.req.items
                    .map((item, idx) => (
                      <tr
                        key={item._id}
                        className={`modern-tableRow
                          ${item.itemStatus === "Approved" ? "modern-rowReceived" : ""}
                          ${(item.itemStatus !== "Approved" && (item.requestedQuantity > item.availableQuantity)) ? "modern-rowLowStock" : ""}
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
                                      ? { ...i, _selected: e.target.checked }
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
                          <span className="modern-itemNumber">{idx + 1}</span>
                        </td>
                        <td className="modern-td-product">
                          <div className="modern-productInfo">
                            <span className="modern-productName">
                              {item.item?.name || "—"}
                            </span>
                            {((item.availableQuantity < item.requestedQuantity) 
                              && item.itemStatus !== 'Approved') && (
                              <span className="modern-error-text">
                                Not enough stock for request
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
                              max={Math.min(item.requestedQuantity, item.availableQuantity)}
                              value={item.approvedQuantity}
                              onChange={(e) => {
                                let value = Number(e.target.value);
                                if (value < 0) value = 0;
                                if (value > Math.min(item.requestedQuantity, item.availableQuantity)) {
                                    value = Math.min(item.requestedQuantity, item.availableQuantity);
                                }
                                handleQuantityChange(viewRequestModal.req._id, item.item._id, value);
                              }}
                              onBlur={() => setEditingItemId(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") setEditingItemId(null);
                              }}
                              className="modern-quantity-input"
                              autoFocus
                            />
                          ) : (
                            <>
                              <span className="modern-quantity">{item.approvedQuantity}</span>
                              <button
                                className="modern-td-approved-quantity-editBtn"
                                onClick={() => {
                                  if(item.itemStatus !== 'Approved') {
                                    setEditingItemId(item.item._id)
                                  }
                                }}
                                title={item.itemStatus !== 'Approved' ? "Edit approved quantity" : "Already Approved"}
                              >
                                <FiEdit2 size={14}/>
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
                            <span>{item.itemStatus || "Pending"}</span>
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
                    <span className="modern-summaryLabel">Items Total</span>
                    <span className="modern-summaryValue">
                      {viewRequestModal.req.items.length} items
                    </span>
                  </div>
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal.open && (
        <div className="requestsTab-modalOverlay">
          <div className="requestsTab-confirmationModal">
            <div className="requestsTab-confirmationHeader">
              <div className="requestsTab-confirmationIcon">
                <FiAlertTriangle size={24} />
              </div>
              <h3>
                {confirmationModal.type === "receive"
                  ? "Confirm Request Receipt"
                  : "Confirm Request Deletion"}
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
                    <strong>Assistant's Email:</strong>{" "}
                    {confirmationModal.req.fromAssistantEmail || "Unknown"}
                  </div>
                  <div>
                    <strong>Request Date:</strong>{" "}
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
                Cancel
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
                  ? "Yes, Mark as Received"
                  : "Yes, Delete Request"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
export default StockRequestsTab