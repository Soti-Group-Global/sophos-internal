import React, { useEffect, useState, useRef } from "react";
import {
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  deletePurchaseOrder,
  getSuppliers,
  getSupplierItems,
  createPurchaseOrderWithPDF,
  updatePurchaseOrderItemStatus,
  getReorderSuggestions,
} from "../../utils/api";
import {
  FiPlus,
  FiX,
  FiTruck,
  FiTrash2,
  FiCheckSquare,
  FiPackage,
  FiCalendar,
  FiDollarSign,
  FiEye,
  FiPhone,
  FiMail,
  FiUser,
  FiAlertTriangle,
  FiMapPin,
} from "react-icons/fi";
import "../../styles/OrdersTab.css";
import logo from "../../assets/logo.png";
import { generateReceiptPDF } from "../../utils/pdfGenerator";
const OrdersTab = () => {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierItems, setSupplierItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoReorderItems, setAutoReorderItems] = useState([]);
  const [formData, setFormData] = useState({
    items: [],
  });
  const [viewItemsModal, setViewItemsModal] = useState({
    open: false,
    order: null,
  });
  const [confirmationModal, setConfirmationModal] = useState({
    open: false,
    type: "", // 'receive' or 'delete'
    order: null,
    message: "",
  });

  const [orderPreview, setOrderPreview] = useState({
    open: false,
    groupedOrders: [],
    currentIndex: 0,
    confirmed: false,
  });

  const [sendingEmail, setSendingEmail] = useState(false);
  const receiptRefs = useRef({});

  const setReceiptRef = (supplierId, element) => {
    if (element) {
      receiptRefs.current[supplierId] = element;
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await fetchData();

      // Fetch reorder suggestions silently
      try {
        const reorderItems = await getReorderSuggestions();

        if (reorderItems && reorderItems.length > 0) {
          const autoFormItems = reorderItems.map((item) => ({
            supplier: item.preferredSupplier?._id || "",
            item: item.item,
            quantity: item.reorderQuantity,
            price: 0, // auto-filled later
          }));

          setAutoReorderItems(autoFormItems);
        }
      } catch (err) {
        console.error("Error fetching reorder suggestions:", err);
      }
    };

    initialize();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersData, suppliersData, supplierItemsData] = await Promise.all([
        getPurchaseOrders(),
        getSuppliers(),
        getSupplierItems(),
      ]);
      setOrders(ordersData);
      setSuppliers(suppliersData);
      setSupplierItems(supplierItemsData);
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
    setLoading(false);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { supplier: "", item: "", quantity: 1, price: 0 },
      ],
    });
  };

  const handleRemoveItem = (index) => {
    const updated = [...formData.items];
    updated.splice(index, 1);
    setFormData({ ...formData, items: updated });
  };

  const handleGlobalSupplierChange = (useGlobal) => {
    if (useGlobal && formData.items.length > 0) {
      const firstSupplier = formData.items[0].supplier;
      if (firstSupplier) {
        const updatedItems = formData.items.map((item) => ({
          ...item,
          supplier: firstSupplier,
        }));
        setFormData({ ...formData, items: updatedItems });
      }
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...formData.items];
    updated[index][field] = value;

    if (
      (field === "item" || field === "supplier") &&
      updated[index].item &&
      updated[index].supplier
    ) {
      const selectedProduct = supplierItems.find(
        (si) =>
          si.supplier?._id?.toString() ===
            updated[index].supplier?.toString() &&
          si.item?._id?.toString() === updated[index].item?.toString()
      );
      if (selectedProduct) {
        updated[index].price = selectedProduct.price || 0;
      }
    }

    if (field === "item" && updated[index].supplier) {
      const availableSuppliers = supplierItems
        .filter((si) => si.item?._id?.toString() === value?.toString())
        .map((si) => si.supplier._id);

      if (!availableSuppliers.includes(updated[index].supplier)) {
        updated[index].supplier = "";
        updated[index].price = 0;
      }
    }

    setFormData({ ...formData, items: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      alert("Please add at least one order item.");
      return;
    }

    // Group items by supplier before confirmation
    const grouped = formData.items.reduce((acc, item) => {
      if (!acc[item.supplier]) acc[item.supplier] = [];
      acc[item.supplier].push(item);
      return acc;
    }, {});

    const groupedOrders = Object.entries(grouped).map(([supplierId, items]) => {
      const supplier = suppliers.find((s) => s._id === supplierId);

      const totalAmount = items.reduce(
        (sum, i) => sum + Number(i.price || 0) * i.quantity,
        0
      );

      return {
        supplier: supplier || {
          _id: supplierId || `unknown-${Math.random()}`,
          name: "Unknown Supplier",
        },
        items,
        totalAmount,
      };
    });

    setOrderPreview({
      open: true,
      groupedOrders,
      currentIndex: 0,
      confirmed: false,
    });
  };

  // Show confirmation modal for receive action
  const showReceiveConfirmation = (order) => {
    setConfirmationModal({
      open: true,
      type: "receive",
      order: order,
      message: `Are you sure you want to mark order from ${
        order.supplier?.name || "Unknown Supplier"
      } as received? This action cannot be undone.`,
    });
  };

  // Show confirmation modal for delete action
  const showDeleteConfirmation = (order) => {
    setConfirmationModal({
      open: true,
      type: "delete",
      order: order,
      message: `Are you sure you want to delete the order from ${
        order.supplier?.name || "Unknown Supplier"
      }? This action cannot be undone and all order data will be permanently lost.`,
    });
  };

  // Handle confirmed receive action
  const handleReceive = async () => {
    if (!confirmationModal.order) return;

    try {
      await receivePurchaseOrder(confirmationModal.order._id);
      fetchData();
      setConfirmationModal({ open: false, type: "", order: null, message: "" });
    } catch (err) {
      alert("Error receiving order");
      setConfirmationModal({ open: false, type: "", order: null, message: "" });
    }
  };

  // Handle confirmed delete action
  const handleDelete = async () => {
    if (!confirmationModal.order) return;

    try {
      await deletePurchaseOrder(confirmationModal.order._id);
      fetchData();
      setConfirmationModal({ open: false, type: "", order: null, message: "" });
    } catch (err) {
      alert("Error deleting order");
      setConfirmationModal({ open: false, type: "", order: null, message: "" });
    }
  };

  const calculateOrderTotal = (order) => {
    return order.items.reduce(
      (sum, i) => sum + Number(i.price || 0) * i.quantity,
      0
    );
  };

  const resetForm = () => {
    setFormData({ items: [] });
  };

  const handleConfirmOrders = async () => {
    if (!orderPreview.confirmed) return;

    setSendingEmail(true);
    try {
      const results = [];
      const ordersWithSuppliers = [];

      // Process each supplier's order
      for (const order of orderPreview.groupedOrders) {
        try {
          // Generate PDF for this supplier's order
          let pdfData = null;
          const receiptElement = receiptRefs.current[order.supplier._id];

          if (receiptElement && order.supplier?.email) {
            const { pdfBase64, fileName } = await generateReceiptPDF(
              receiptElement,
              order.supplier.name
            );
            pdfData = {
              base64: pdfBase64,
              fileName: fileName,
            };
          }

          // Store order data for creation
          ordersWithSuppliers.push({
            supplier: order.supplier._id,
            items: order.items,
            totalAmount: order.totalAmount,
            supplierEmail: order.supplier?.email,
            supplierName: order.supplier?.name,
            pdfData: pdfData,
          });
        } catch (orderError) {
          console.error(
            `Failed to process order for ${order.supplier?.name}:`,
            orderError
          );
        }
      }

      // Create all orders (backend will handle email sending)
      for (const orderData of ordersWithSuppliers) {
        try {
          const createdOrder = await createPurchaseOrderWithPDF(orderData);
          results.push(createdOrder);
        } catch (createError) {
          console.error(
            `Failed to create order for ${orderData.supplierName}:`,
            createError
          );
        }
      }

      // Show success message with summary
      const successfulOrders = results.length;
      const totalOrders = orderPreview.groupedOrders.length;
      const emailCount = orderPreview.groupedOrders.filter(
        (order) => order.supplier?.email
      ).length;

      if (successfulOrders === totalOrders) {
        alert(
          `Successfully created ${successfulOrders} order(s) for ${totalOrders} supplier(s)! ${
            emailCount > 0
              ? `PDF receipts will be emailed to ${emailCount} supplier(s).`
              : ""
          }`
        );
      } else {
        alert(
          `Created ${successfulOrders} out of ${totalOrders} order(s). ${
            emailCount > 0 ? "PDF receipts will be emailed where possible." : ""
          }`
        );
      }

      // Reset everything
      fetchData();
      resetForm();
      setOrderPreview({
        open: false,
        groupedOrders: [],
        currentIndex: 0,
        confirmed: false,
      });
      setShowModal(false);
    } catch (err) {
      console.error("Error creating orders:", err);
      alert("Failed to create orders. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading)
    return (
      <div className="ordersTab-loading">
        <div className="ordersTab-spinner"></div>
        <p>Loading purchase orders...</p>
      </div>
    );

  return (
    <div className="ordersTab-container">
      {/* Header */}
      <div className="ordersTab-header">
        <div className="ordersTab-headerContent">
          <div className="ordersTab-titleSection">
            <div className="ordersTab-iconWrapper">
              <FiTruck size={24} />
            </div>
            <div>
              <h1>Purchase Orders</h1>
              <p>Manage multi-supplier inventory purchases</p>
            </div>
          </div>
          <button
            className="ordersTab-addBtn ordersTab-smartOrderBtn"
            onClick={() => {
              setFormData({
                items: autoReorderItems.length > 0 ? autoReorderItems : [],
              });
              setShowModal(true);
            }}
          >
            <div className="ordersTab-btnContent">
              <div className="ordersTab-btnIcon">
                <FiPlus size={18} />
              </div>
              <div className="ordersTab-btnText">
                <span className="ordersTab-btnTitle">New Order</span>
                {autoReorderItems.length > 0 && (
                  <span className="ordersTab-btnSubtitle">
                    {autoReorderItems.length} low stock item
                    {autoReorderItems.length !== 1 ? "s" : ""} ready to reorder
                  </span>
                )}
              </div>
              {autoReorderItems.length > 0 && (
                <div className="ordersTab-smartBadge">
                  <span className="ordersTab-badgeCount">
                    {autoReorderItems.length}
                  </span>
                  <div className="ordersTab-badgePulse"></div>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="ordersTab-stats">
        <div className="ordersTab-statCard">
          <div className="ordersTab-statIcon ordersTab-statTotal">
            <FiPackage size={20} />
          </div>
          <div className="ordersTab-statInfo">
            <span className="ordersTab-statNumber">{orders.length}</span>
            <span className="ordersTab-statLabel">Total Orders</span>
          </div>
        </div>
        <div className="ordersTab-statCard">
          <div className="ordersTab-statIcon ordersTab-statPending">
            <FiCalendar size={20} />
          </div>
          <div className="ordersTab-statInfo">
            <span className="ordersTab-statNumber">
              {orders.filter((o) => o.status === "Pending").length}
            </span>
            <span className="ordersTab-statLabel">Pending</span>
          </div>
        </div>
        <div className="ordersTab-statCard">
          <div className="ordersTab-statIcon ordersTab-statReceived">
            <FiCheckSquare size={20} />
          </div>
          <div className="ordersTab-statInfo">
            <span className="ordersTab-statNumber">
              {orders.filter((o) => o.status === "Received").length}
            </span>
            <span className="ordersTab-statLabel">Received</span>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="ordersTab-content">
        <div className="ordersTab-sectionHeader">
          <h3>Recent Orders</h3>
          <span className="ordersTab-subtitle">
            All purchase orders (multi-supplier)
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="ordersTab-emptyState">
            <FiTruck size={64} />
            <h4>No purchase orders yet</h4>
            <p>Create your first order below</p>
            <button
              className="ordersTab-addBtn ordersTab-primaryBtn"
              onClick={() => setShowModal(true)}
            >
              <FiPlus /> Create Order
            </button>
          </div>
        ) : (
          <div className="ordersTab-tableContainer">
            <table className="ordersTab-table">
              <thead>
                <tr>
                  <th>Suppliers</th>
                  <th>Order Date</th>
                  <th>Status</th>
                  <th>Total Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const total = calculateOrderTotal(order);
                  return (
                    <tr key={order._id}>
                      <td>{order.supplier?.name || "—"}</td>
                      <td>
                        <FiCalendar size={14} />{" "}
                        {new Date(order.orderDate).toLocaleDateString()}
                      </td>
                      <td>
                        <span
                          className={`ordersTab-status ordersTab-status-${order.status.toLowerCase()}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td>₹ {order.totalAmount}</td>
                      <td className="ordersTab-actionButtons">
                        <button
                          className="ordersTab-viewItemsBtn"
                          onClick={() =>
                            setViewItemsModal({ open: true, order })
                          }
                          title="View all items"
                        >
                          <FiEye />
                        </button>
                        {order.status !== "Received" && (
                          <button
                            className="ordersTab-receiveBtn"
                            onClick={() => showReceiveConfirmation(order)}
                            title="Mark as received"
                          >
                            <FiCheckSquare />
                          </button>
                        )}
                        <button
                          className="ordersTab-deleteBtn"
                          onClick={() => showDeleteConfirmation(order)}
                          title="Delete order"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modern View Items Modal */}
      {viewItemsModal.open && viewItemsModal.order && (
        <div className="ordersTab-modalOverlay">
          <div className="ordersTab-modal ordersTab-modernModal">
            {/* Header */}
            <div className="ordersTab-modalHeader modern-header">
              <div className="modern-headerContent">
                <div className="modern-headerMain">
                  <div className="modern-orderBadge">
                    <FiPackage size={20} />
                  </div>
                  <div className="modern-headerData">
                    <div className="modern-headerText">
                      <h3>Purchase Order Details</h3>
                      <p className="modern-orderSupplier">
                        Supplier:{" "}
                        <span className="modern-supplierName">
                          {viewItemsModal.order.supplier?.name ||
                            "Unknown Supplier"}
                        </span>
                      </p>
                    </div>
                    <div className="modern-headerMeta">
                      <div className="modern-metaItem">
                        <span className="modern-metaLabel">PO Number:</span>
                        <span className="modern-metaValue">
                          #{viewItemsModal.order._id?.slice(-8).toUpperCase()}
                        </span>
                      </div>
                      <div className="modern-metaItem">
                        <span className="modern-metaLabel">Order Date:</span>
                        <span className="modern-metaValue">
                          {new Date(
                            viewItemsModal.order.orderDate
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button
                className="ordersTab-closeBtn modern-closeBtn"
                onClick={() => setViewItemsModal({ open: false, order: null })}
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
                    {viewItemsModal.order.supplier?.contactPerson ||
                      "No contact person"}
                  </span>
                </div>
                <div className="modern-contactItem">
                  <FiPhone size={16} />
                  <span>
                    {viewItemsModal.order.supplier?.phone || "No phone"}
                  </span>
                </div>
                <div className="modern-contactItem">
                  <FiMail size={16} />
                  <span>
                    {viewItemsModal.order.supplier?.email || "No email"}
                  </span>
                </div>
              </div>
              <div
                className={`modern-statusBadge modern-status-${viewItemsModal.order.status.toLowerCase()}`}
              >
                {viewItemsModal.order.status}
              </div>
            </div>

            {/* Items Section */}
            <div className="modern-itemsSection">
              {/* Controls */}
              <div className="modern-controls">
                {viewItemsModal.order.items.every(
                  (i) => i.itemStatus === "Received"
                ) ? (
                  <div className="modern-completeNotice">
                    <div className="modern-completeIcon">
                      <FiCheckSquare size={20} />
                    </div>
                    <div className="modern-completeText">
                      <span className="modern-completeTitle">
                        Order Complete
                      </span>
                      <span className="modern-completeSubtitle">
                        All items have been received
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="modern-actionControls">
                    <label className="modern-selectAll">
                      <div className="modern-checkbox">
                        <input
                          type="checkbox"
                          checked={viewItemsModal.order.items.every(
                            (i) => i.itemStatus === "Received" || i._selected
                          )}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            const updatedOrder = {
                              ...viewItemsModal.order,
                              items: viewItemsModal.order.items.map((item) => ({
                                ...item,
                                _selected: isChecked,
                              })),
                            };
                            setViewItemsModal((prev) => ({
                              ...prev,
                              order: updatedOrder,
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
                        const selectedItems = viewItemsModal.order.items.filter(
                          (i) => i._selected && i.itemStatus !== "Received"
                        );

                        if (selectedItems.length === 0) {
                          alert(
                            "Please select at least one product to mark as received."
                          );
                          return;
                        }

                        const updatedItems = [...viewItemsModal.order.items];

                        for (const item of selectedItems) {
                          await updatePurchaseOrderItemStatus(
                            viewItemsModal.order._id,
                            item._id,
                            {
                              status: "Received",
                              receivedQuantity: item.quantity,
                            }
                          );

                          const idx = updatedItems.findIndex(
                            (i) => i._id === item._id
                          );
                          if (idx !== -1) {
                            updatedItems[idx].itemStatus = "Received";
                            updatedItems[idx]._selected = false;
                          }
                        }

                        const allReceived = updatedItems.every(
                          (i) => i.itemStatus === "Received"
                        );

                        setViewItemsModal((prev) => ({
                          ...prev,
                          order: {
                            ...prev.order,
                            status: allReceived
                              ? "Received"
                              : prev.order.status,
                            items: updatedItems,
                          },
                        }));

                        fetchData();
                      }}
                    >
                      <FiCheckSquare size={16} />
                      Mark Selected as Received
                      <span className="modern-badge">
                        {
                          viewItemsModal.order.items.filter(
                            (i) => i._selected && i.itemStatus !== "Received"
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
                            checked={viewItemsModal.order.items.every(
                              (i) => i._selected
                            )}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              const updatedOrder = {
                                ...viewItemsModal.order,
                                items: viewItemsModal.order.items.map(
                                  (item) => ({
                                    ...item,
                                    _selected: isChecked,
                                  })
                                ),
                              };
                              setViewItemsModal((prev) => ({
                                ...prev,
                                order: updatedOrder,
                              }));
                            }}
                          />
                          <span className="modern-checkmark"></span>
                        </div>
                      </th>
                      <th className="modern-th-number">#</th>
                      <th className="modern-th-product">Product</th>
                      <th className="modern-th-category">Category</th>
                      <th className="modern-th-quantity">Qty</th>
                      <th className="modern-th-price">Price</th>
                      <th className="modern-th-total">Total</th>
                      <th className="modern-th-status">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewItemsModal.order.items.map((item, idx) => (
                      <tr
                        key={item._id}
                        className={`modern-tableRow ${
                          item.itemStatus === "Received"
                            ? "modern-rowReceived"
                            : ""
                        }`}
                      >
                        <td className="modern-td-checkbox">
                          <div className="modern-checkbox">
                            <input
                              type="checkbox"
                              checked={!!item._selected}
                              onChange={(e) => {
                                const updatedItems =
                                  viewItemsModal.order.items.map((i) =>
                                    i._id === item._id
                                      ? { ...i, _selected: e.target.checked }
                                      : i
                                  );
                                setViewItemsModal((prev) => ({
                                  ...prev,
                                  order: { ...prev.order, items: updatedItems },
                                }));
                              }}
                              disabled={item.itemStatus === "Received"}
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
                            {item.item?.description && (
                              <span className="modern-productDesc">
                                {item.item.description}
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
                            {item.quantity}
                          </span>
                        </td>
                        <td className="modern-td-price">
                          <span className="modern-price">
                            ₹{item.costPrice?.toFixed(2) || "0.00"}
                          </span>
                        </td>
                        <td className="modern-td-total">
                          <span className="modern-total">
                            ₹{(item.quantity * item.costPrice).toFixed(2)}
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
                      {viewItemsModal.order.items.length} items
                    </span>
                  </div>
                  <div className="modern-summaryItem">
                    <span className="modern-summaryLabel">Order Total</span>
                    <span className="modern-summaryTotal">
                      ₹{viewItemsModal.order.totalAmount?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal.open && (
        <div className="ordersTab-modalOverlay">
          <div className="ordersTab-confirmationModal">
            <div className="ordersTab-confirmationHeader">
              <div className="ordersTab-confirmationIcon">
                <FiAlertTriangle size={24} />
              </div>
              <h3>
                {confirmationModal.type === "receive"
                  ? "Confirm Order Receipt"
                  : "Confirm Order Deletion"}
              </h3>
              <button
                className="ordersTab-closeBtn"
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

            <div className="ordersTab-confirmationContent">
              <p>{confirmationModal.message}</p>

              {confirmationModal.order && (
                <div className="ordersTab-confirmationDetails">
                  <div>
                    <strong>Supplier:</strong>{" "}
                    {confirmationModal.order.supplier?.name || "Unknown"}
                  </div>
                  <div>
                    <strong>Order Date:</strong>{" "}
                    {new Date(
                      confirmationModal.order.orderDate
                    ).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Total Amount:</strong> ₹
                    {confirmationModal.order.totalAmount?.toFixed(2) || "0.00"}
                  </div>
                </div>
              )}
            </div>

            <div className="ordersTab-confirmationActions">
              <button
                className="ordersTab-cancelConfirmBtn"
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
                    ? "ordersTab-confirmReceiveBtn"
                    : "ordersTab-confirmDeleteBtn"
                }
                onClick={
                  confirmationModal.type === "receive"
                    ? handleReceive
                    : handleDelete
                }
              >
                {confirmationModal.type === "receive"
                  ? "Yes, Mark as Received"
                  : "Yes, Delete Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showModal && (
        <div className="ordersTab-modalOverlay">
          <div className="ordersTab-modal">
            <div className="ordersTab-modalHeader">
              <h3>Create Multi-Supplier Purchase Order</h3>
              <button
                className="ordersTab-closeBtn"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="ordersTab-form">
              {/* Global Supplier Option - Only show when items exist */}
              {formData.items.length > 0 && (
                <div className="ordersTab-globalSupplier">
                  <label>
                    <input
                      type="checkbox"
                      onChange={(e) =>
                        handleGlobalSupplierChange(e.target.checked)
                      }
                    />
                    Use first product's supplier for all items
                  </label>
                </div>
              )}

              <div className="ordersTab-itemsSection">
                <h4>Order Items</h4>
                {formData.items.length === 0 ? (
                  <div className="ordersTab-emptyState">
                    <div className="ordersTab-emptyContent">
                      <FiPackage size={48} className="ordersTab-emptyIcon" />
                      <h4>No items added yet</h4>
                      <p>Click "Add Your First Product" to begin</p>
                      <button
                        type="button"
                        className="ordersTab-addFirstBtn"
                        onClick={handleAddItem}
                      >
                        <FiPlus /> Add Your First Product
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ordersTab-itemsList">
                    {/* Table Header */}
                    <div className="ordersTab-itemHeader">
                      <div>Product</div>
                      <div>Supplier</div>
                      <div>Quantity</div>
                      <div>Price (₹)</div>
                      <div>Subtotal (₹)</div>
                      <div>Action</div>
                    </div>

                    {/* Item Rows */}
                    {formData.items.map((entry, index) => {
                      const availableSuppliers = supplierItems
                        .filter(
                          (si) =>
                            si.item?._id?.toString() === entry.item?.toString()
                        )
                        .map((si) => si.supplier);

                      return (
                        <div className="ordersTab-itemRow" key={index}>
                          {/* Product First */}
                          <div className="ordersTab-formGroup">
                            <select
                              value={entry.item}
                              onChange={(e) =>
                                handleItemChange(index, "item", e.target.value)
                              }
                              required
                            >
                              <option value="">Select Product</option>
                              {supplierItems
                                .filter((si) => si.item?._id)
                                .filter(
                                  (si, idx, arr) =>
                                    arr.findIndex(
                                      (s) => s.item?._id === si.item?._id
                                    ) === idx
                                )
                                .map((sp) => (
                                  <option key={sp.item._id} value={sp.item._id}>
                                    {sp.item.name} -{" "}
                                    {sp.item.category || "Uncategorized"}
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Supplier - Auto-filtered based on product */}
                          <div className="ordersTab-formGroup">
                            <select
                              value={entry.supplier}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "supplier",
                                  e.target.value
                                )
                              }
                              required
                              disabled={!entry.item}
                            >
                              <option value="">Select Supplier</option>
                              {availableSuppliers.map((s) => (
                                <option key={s._id} value={s._id}>
                                  {s.name}
                                  {s.contactPerson && ` (${s.contactPerson})`}
                                </option>
                              ))}
                            </select>
                            {availableSuppliers.length === 0 && entry.item && (
                              <span className="ordersTab-noSupplierWarning">
                                No suppliers for this product
                              </span>
                            )}
                          </div>

                          {/* Quantity */}
                          <div className="ordersTab-formGroup">
                            <input
                              type="number"
                              min="1"
                              value={entry.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "quantity",
                                  e.target.value
                                )
                              }
                              required
                            />
                          </div>

                          {/* Price - Auto-filled when both product and supplier selected */}
                          <div className="ordersTab-formGroup">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={entry.price}
                              onChange={(e) =>
                                handleItemChange(index, "price", e.target.value)
                              }
                              required
                              readOnly={entry.item && entry.supplier}
                              className={
                                entry.item && entry.supplier
                                  ? "ordersTab-autoPrice"
                                  : ""
                              }
                            />
                            {entry.item && entry.supplier && (
                              <span className="ordersTab-priceNote">
                                Auto-filled
                              </span>
                            )}
                          </div>

                          {/* Subtotal */}
                          <div className="ordersTab-subtotal">
                            ₹
                            {(
                              Number(entry.quantity) * Number(entry.price)
                            ).toFixed(2)}
                          </div>

                          {/* Remove Button */}
                          <button
                            type="button"
                            className="ordersTab-removeItemBtn"
                            onClick={() => handleRemoveItem(index)}
                            title="Remove item"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Regular Add Item Button - Only show when items exist */}
              {formData.items.length > 0 && (
                <button
                  type="button"
                  className="ordersTab-addItemBtn"
                  onClick={handleAddItem}
                >
                  <FiPlus /> Add Another Item
                </button>
              )}

              {formData.items.length > 0 && (
                <div className="ordersTab-formActions">
                  <div className="ordersTab-orderSummary">
                    <strong>
                      Total: ₹
                      {formData.items
                        .reduce(
                          (sum, i) => sum + Number(i.price || 0) * i.quantity,
                          0
                        )
                        .toFixed(2)}
                    </strong>
                  </div>
                  <div className="ordersTab-actionButtons">
                    <button
                      type="button"
                      className="ordersTab-cancelBtn"
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="ordersTab-saveBtn">
                      Create Order
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Order Review Modal - Receipt Style */}
      {orderPreview.open && (
        <div className="ordersTab-modalOverlay">
          <div className="ordersTab-modal ordersTab-hospitalReceipt">
            {/* Hidden receipt elements for PDF generation - One for each supplier */}
            {orderPreview.groupedOrders.map((order, index) => (
              <div
                key={order?.supplier?._id || `order-${index}`}
                ref={(el) =>
                  setReceiptRef(order?.supplier?._id || `order-${index}`, el)
                }
                style={{
                  position: "absolute",
                  left: "-9999px",
                  top: 0,
                  width: "210mm",
                  minHeight: "297mm",
                  background: "white",
                  fontFamily: "Arial, sans-serif",
                  display:
                    orderPreview.currentIndex === index ? "block" : "none",
                }}
              >
                {/* Individual Supplier Receipt Template */}
                <div className="ordersTab-receiptHeader">
                  <div className="ordersTab-hospitalLogo">
                    <img
                      src={logo}
                      alt="Health-Direct"
                      className="hospitalLogo"
                    />
                  </div>
                  <div className="ordersTab-hospitalContact">
                    <p>123 Medical Center Drive, Healthcare City</p>
                    <p>📞 +91 98765 43210 | ✉️ info@health-direct.com</p>
                    <p>🌐 www.health-direct.com</p>
                  </div>
                </div>

                <div className="ordersTab-receiptTitle">
                  <h2>PURCHASE ORDER RECEIPT</h2>
                  <div className="ordersTab-receiptMeta">
                    <span>Date: {new Date().toLocaleDateString("en-IN")}</span>
                    <span>
                      Time:{" "}
                      {new Date().toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>
                      PO Number: HD-{Date.now().toString().slice(-6)}-
                      {index + 1}
                    </span>
                  </div>
                </div>

                {/* Supplier Information */}
                <div className="ordersTab-supplierSection">
                  <h3>Supplier Information</h3>
                  <div className="ordersTab-supplierDetails">
                    <div className="ordersTab-supplierMain">
                      <div className="ordersTab-supplierName">
                        <strong>
                          {order.supplier?.name || "Unknown Supplier"}
                        </strong>
                      </div>
                      {order.supplier?.contactPerson && (
                        <div className="ordersTab-contactPerson">
                          Contact: {order.supplier.contactPerson}
                        </div>
                      )}
                    </div>
                    <div className="ordersTab-supplierContact">
                      {order.supplier?.phone && (
                        <div className="ordersTab-contactItem">
                          <span>📞</span>
                          {order.supplier.phone}
                        </div>
                      )}
                      {order.supplier?.email && (
                        <div className="ordersTab-contactItem">
                          <span>✉️</span>
                          {order.supplier.email}
                        </div>
                      )}
                      {order.supplier?.address && (
                        <div className="ordersTab-contactItem">
                          <span>📍</span>
                          {order.supplier.address}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order Items Table */}
                <div className="ordersTab-itemsSection">
                  <h3>Order Items</h3>
                  <div className="ordersTab-itemsTable">
                    <table className="ordersTab-receiptTable">
                      <thead>
                        <tr>
                          <th width="8%">#</th>
                          <th width="42%">PRODUCT DESCRIPTION</th>
                          <th width="15%">CATEGORY</th>
                          <th width="10%">QTY</th>
                          <th width="15%">UNIT PRICE</th>
                          <th width="15%">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => {
                          const product = supplierItems.find(
                            (si) => si.item?._id === item.item
                          )?.item;
                          return (
                            <tr key={idx} className="ordersTab-tableRow">
                              <td className="ordersTab-itemIndex">{idx + 1}</td>
                              <td className="ordersTab-itemName">
                                <strong>{product?.name || "—"}</strong>
                                {product?.description && (
                                  <span className="ordersTab-itemDesc">
                                    {product.description}
                                  </span>
                                )}
                              </td>
                              <td className="ordersTab-itemCategory">
                                {product?.category || "—"}
                              </td>
                              <td className="ordersTab-itemQty">
                                {item.quantity}
                              </td>
                              <td className="ordersTab-itemPrice">
                                ₹{Number(item.price).toFixed(2)}
                              </td>
                              <td className="ordersTab-itemTotal">
                                <strong>
                                  ₹{(item.quantity * item.price).toFixed(2)}
                                </strong>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="ordersTab-summarySection">
                  <div className="ordersTab-summaryCard">
                    <div className="ordersTab-summaryRow">
                      <span>Subtotal:</span>
                      <span>₹{order.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="ordersTab-summaryRow">
                      <span>GST (0%):</span>
                      <span>₹0.00</span>
                    </div>
                    <div className="ordersTab-summaryRow ordersTab-grandTotal">
                      <span>
                        <strong>GRAND TOTAL:</strong>
                      </span>
                      <span>
                        <strong>₹{order.totalAmount.toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Notes */}
                <div className="ordersTab-receiptFooter">
                  <div className="ordersTab-footerNotes">
                    <p>
                      <strong>Delivery Instructions:</strong> All medical
                      supplies must be delivered to the main storage facility.
                      Please ensure proper handling of sensitive medical
                      equipment.
                    </p>
                    <p>
                      <strong>Quality Standards:</strong> All products must meet
                      Health-Direct medical quality standards and include proper
                      certification.
                    </p>
                    <p>
                      <strong>Payment Terms:</strong> Net 30 days from date of
                      invoice.
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Visible receipt content for user review */}
            <div className="ordersTab-receiptContainer">
              {/* Receipt Header */}
              <div className="ordersTab-receiptHeader">
                <div className="ordersTab-hospitalLogo">
                  <img
                    src={logo}
                    alt="Health-Direct"
                    className="hospitalLogo"
                  />
                </div>
                <div className="ordersTab-hospitalContact">
                  <p>123 Medical Center Drive, Healthcare City</p>
                  <p>📞 +91 98765 43210 | ✉️ info@health-direct.com</p>
                  <p>🌐 www.health-direct.com</p>
                </div>
              </div>

              {/* Receipt Title */}
              <div className="ordersTab-receiptTitle">
                <h2>PURCHASE ORDER RECEIPT</h2>
                <div className="ordersTab-receiptMeta">
                  <span>Date: {new Date().toLocaleDateString("en-IN")}</span>
                  <span>
                    Time:{" "}
                    {new Date().toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>
                    Supplier: {orderPreview.currentIndex + 1} of{" "}
                    {orderPreview.groupedOrders.length}
                  </span>
                </div>
              </div>

              {/* Main Content */}
              <div className="ordersTab-receiptBody">
                {orderPreview.groupedOrders.length > 0 && (
                  <>
                    {(() => {
                      const currentOrder =
                        orderPreview.groupedOrders[orderPreview.currentIndex];
                      return (
                        <>
                          {/* Supplier Information */}
                          <div className="ordersTab-supplierSection">
                            <h3>Supplier Information</h3>
                            <div className="ordersTab-supplierDetails">
                              <div className="ordersTab-supplierMain">
                                <div className="ordersTab-supplierName">
                                  <strong>
                                    {currentOrder.supplier?.name ||
                                      "Unknown Supplier"}
                                  </strong>
                                </div>
                                {currentOrder.supplier?.contactPerson && (
                                  <div className="ordersTab-contactPerson">
                                    Contact:{" "}
                                    {currentOrder.supplier.contactPerson}
                                  </div>
                                )}
                              </div>
                              <div className="ordersTab-supplierContact">
                                {currentOrder.supplier?.phone && (
                                  <div className="ordersTab-contactItem">
                                    <FiPhone size={14} />
                                    {currentOrder.supplier.phone}
                                  </div>
                                )}
                                {currentOrder.supplier?.email && (
                                  <div className="ordersTab-contactItem">
                                    <FiMail size={14} />
                                    {currentOrder.supplier.email}
                                  </div>
                                )}
                                {currentOrder.supplier?.address && (
                                  <div className="ordersTab-contactItem">
                                    <FiMapPin size={14} />
                                    {currentOrder.supplier.address}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Order Items Table */}
                          <div className="ordersTab-itemsSection">
                            <h3>Order Items</h3>
                            <div className="ordersTab-itemsTable">
                              <table className="ordersTab-receiptTable">
                                <thead>
                                  <tr>
                                    <th width="8%">#</th>
                                    <th width="42%">PRODUCT DESCRIPTION</th>
                                    <th width="15%">CATEGORY</th>
                                    <th width="10%">QTY</th>
                                    <th width="15%">UNIT PRICE</th>
                                    <th width="15%">TOTAL</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {currentOrder.items.map((item, idx) => {
                                    const product = supplierItems.find(
                                      (si) => si.item?._id === item.item
                                    )?.item;
                                    return (
                                      <tr
                                        key={idx}
                                        className="ordersTab-tableRow"
                                      >
                                        <td className="ordersTab-itemIndex">
                                          {idx + 1}
                                        </td>
                                        <td className="ordersTab-itemName">
                                          <strong>
                                            {product?.name || "—"}
                                          </strong>
                                          {product?.description && (
                                            <span className="ordersTab-itemDesc">
                                              {product.description}
                                            </span>
                                          )}
                                        </td>
                                        <td className="ordersTab-itemCategory">
                                          {product?.category || "—"}
                                        </td>
                                        <td className="ordersTab-itemQty">
                                          {item.quantity}
                                        </td>
                                        <td className="ordersTab-itemPrice">
                                          ₹{Number(item.price).toFixed(2)}
                                        </td>
                                        <td className="ordersTab-itemTotal">
                                          <strong>
                                            ₹
                                            {(
                                              item.quantity * item.price
                                            ).toFixed(2)}
                                          </strong>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Order Summary */}
                          <div className="ordersTab-summarySection">
                            <div className="ordersTab-summaryCard">
                              <div className="ordersTab-summaryRow">
                                <span>Subtotal:</span>
                                <span>
                                  ₹{currentOrder.totalAmount.toFixed(2)}
                                </span>
                              </div>
                              <div className="ordersTab-summaryRow">
                                <span>GST (0%):</span>
                                <span>₹0.00</span>
                              </div>
                              <div className="ordersTab-summaryRow ordersTab-grandTotal">
                                <span>
                                  <strong>GRAND TOTAL:</strong>
                                </span>
                                <span>
                                  <strong>
                                    ₹{currentOrder.totalAmount.toFixed(2)}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Footer Notes */}
                          <div className="ordersTab-receiptFooter">
                            <div className="ordersTab-footerNotes">
                              <p>
                                <strong>Delivery Instructions:</strong> All
                                medical supplies must be delivered to the main
                                storage facility. Please ensure proper handling
                                of sensitive medical equipment.
                              </p>
                              <p>
                                <strong>Quality Standards:</strong> All products
                                must meet Health-Direct medical quality
                                standards and include proper certification.
                              </p>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Navigation Arrows - Centered */}
              {orderPreview.groupedOrders.length > 1 && (
                <div className="ordersTab-receiptNavigation">
                  <button
                    className="ordersTab-navArrow ordersTab-prevArrow"
                    disabled={orderPreview.currentIndex === 0}
                    onClick={() =>
                      setOrderPreview((prev) => ({
                        ...prev,
                        currentIndex: prev.currentIndex - 1,
                      }))
                    }
                  >
                    ←
                  </button>

                  <div className="ordersTab-navInfo">
                    Supplier {orderPreview.currentIndex + 1} of{" "}
                    {orderPreview.groupedOrders.length}
                  </div>

                  <button
                    className="ordersTab-navArrow ordersTab-nextArrow"
                    disabled={
                      orderPreview.currentIndex ===
                      orderPreview.groupedOrders.length - 1
                    }
                    onClick={() =>
                      setOrderPreview((prev) => ({
                        ...prev,
                        currentIndex: prev.currentIndex + 1,
                      }))
                    }
                  >
                    →
                  </button>
                </div>
              )}

              {/* Confirmation Section */}
              <div className="ordersTab-confirmationSection">
                <label className="ordersTab-confirmLabel">
                  <input
                    type="checkbox"
                    checked={orderPreview.confirmed}
                    onChange={(e) =>
                      setOrderPreview((prev) => ({
                        ...prev,
                        confirmed: e.target.checked,
                      }))
                    }
                  />
                  <span className="ordersTab-checkboxText">
                    I verify that all supplier details and medical product
                    quantities are accurate for all{" "}
                    {orderPreview.groupedOrders.length} suppliers
                  </span>
                </label>

                <button
                  className="ordersTab-confirmButton"
                  disabled={!orderPreview.confirmed || sendingEmail}
                  onClick={handleConfirmOrders}
                >
                  <FiCheckSquare size={18} />
                  {sendingEmail
                    ? `Creating ${orderPreview.groupedOrders.length} Orders...`
                    : `Confirm & Place ${orderPreview.groupedOrders.length} Orders`}
                </button>
              </div>
            </div>

            {/* Close Button */}
            <button
              className="ordersTab-closeReceiptBtn"
              onClick={() =>
                setOrderPreview({ open: false, groupedOrders: [] })
              }
              disabled={sendingEmail}
            >
              <FiX size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
