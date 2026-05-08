import React, { useEffect, useState } from "react";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getInventoryItems,
  createSupplierItem,
  updateSupplierItem,
  deleteSupplierItem,
  getSupplierItems,
} from "../../utils/api";
import {
  FiEdit,
  FiTrash2,
  FiPlus,
  FiX,
  FiTruck,
  FiPackage,
  FiUser,
  FiPhone,
  FiMail,
  FiMapPin,
  FiEye,
  FiSave,
} from "react-icons/fi";
import "../../styles/SuppliersTab.css";

const SuppliersTab = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [supplierItems, setSupplierItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [suppliersData, itemsData, supplierItemsData] = await Promise.all([
        getSuppliers(),
        getInventoryItems(),
        getSupplierItems(),
      ]);
      setSuppliers(suppliersData);
      setItems(itemsData);
      setSupplierItems(supplierItemsData);
    } catch (err) {
      console.error("Error fetching supplier data:", err);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
    });
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await updateSupplier(editing._id, formData);
      else await createSupplier(formData);
      fetchData();
      resetForm();
      setShowSupplierModal(false);
    } catch (err) {
      alert("Failed to save supplier");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this supplier?"))
      return;
    try {
      await deleteSupplier(id);
      fetchData();
    } catch (err) {
      alert("Error deleting supplier");
    }
  };

  const handleAddLink = async (supplierId, itemId, price) => {
    try {
      await createSupplierItem({ supplier: supplierId, item: itemId, price });
      fetchData();
    } catch (err) {
      alert("Error adding supplier-product link");
    }
  };

  const handleUpdateLink = async (linkId, price) => {
    try {
      await updateSupplierItem(linkId, { price });
      fetchData();
    } catch (err) {
      alert("Error updating product price");
    }
  };

  const handleRemoveLink = async (linkId) => {
    if (!window.confirm("Are you sure you want to delete this product link?"))
      return;
    try {
      await deleteSupplierItem(linkId);
      fetchData();
    } catch (err) {
      alert("Error deleting link");
    }
  };

  const openEditModal = (supplier) => {
    setEditing(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
    });
    setShowSupplierModal(true);
  };

  const openProductsModal = (supplier) => {
    setSelectedSupplier(supplier);
    setShowProductsModal(true);
  };

  const getSupplierProducts = (supplierId) => {
    return supplierItems.filter((link) => link.supplier?._id === supplierId);
  };

  const getProductsCount = (supplierId) => {
    return getSupplierProducts(supplierId).length;
  };

  if (loading)
    return (
      <div className="suppliersTab-loading">
        <div className="suppliersTab-spinner"></div>
        <p>Loading supplier data...</p>
      </div>
    );

  return (
    <div className="suppliersTab-container">
      {/* Header Section */}
      <div className="suppliersTab-header">
        <div className="suppliersTab-headerContent">
          <div className="suppliersTab-titleSection">
            <div className="suppliersTab-iconWrapper">
              <FiTruck size={24} />
            </div>
            <div>
              <h1>Supplier Management</h1>
              <p>Manage your suppliers and their products</p>
            </div>
          </div>
          <button
            className="suppliersTab-addBtn"
            onClick={() => {
              resetForm();
              setShowSupplierModal(true);
            }}
          >
            <FiPlus size={18} /> Add Supplier
          </button>
        </div>
      </div>

      {/* Suppliers Content */}
      <div className="suppliersTab-content">
        <div className="suppliersTab-sectionHeader">
          <h3>Supplier Directory</h3>
          <span className="suppliersTab-subtitle">
            All your suppliers and their products
          </span>
        </div>

        {suppliers.length === 0 ? (
          <div className="suppliersTab-emptyState">
            <FiTruck size={64} />
            <h4>No suppliers found</h4>
            <p>Get started by adding your first supplier</p>
            <button
              className="suppliersTab-addBtn suppliersTab-primaryBtn"
              onClick={() => setShowSupplierModal(true)}
            >
              <FiPlus /> Add First Supplier
            </button>
          </div>
        ) : (
          <div className="suppliersTab-tableContainer">
            <table className="suppliersTab-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Total Products</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const productsCount = getProductsCount(supplier._id);
                  return (
                    <tr key={supplier._id} className="suppliersTab-tableRow">
                      <td className="suppliersTab-supplierName">
                        <strong>{supplier.name}</strong>
                        {supplier.address && (
                          <span className="suppliersTab-addressLine">
                            <FiMapPin size={12} />
                            {supplier.address}
                          </span>
                        )}
                      </td>
                      <td>{supplier.contactPerson || "—"}</td>
                      <td>
                        {supplier.phone ? (
                          <div className="suppliersTab-phone">
                            <FiPhone size={14} />
                            {supplier.phone}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {supplier.email ? (
                          <div className="suppliersTab-email">
                            <FiMail size={14} />
                            {supplier.email}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div className="suppliersTab-productsCount">
                          <span className="suppliersTab-countBadge">
                            {productsCount}{" "}
                            {productsCount === 1 ? "product" : "products"}
                          </span>
                        </div>
                      </td>
                      <td className="suppliersTab-actionButtons">
                        <button
                          className="suppliersTab-viewBtn"
                          onClick={() => openProductsModal(supplier)}
                          title="View products"
                        >
                          <FiEye />
                        </button>
                        <button
                          className="suppliersTab-editBtn"
                          onClick={() => openEditModal(supplier)}
                          title="Edit supplier"
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="suppliersTab-deleteBtn"
                          onClick={() => handleDelete(supplier._id)}
                          title="Delete supplier"
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

      {/* Add/Edit Supplier Modal */}
      {showSupplierModal && (
        <div className="suppliersTab-modalOverlay">
          <div className="suppliersTab-modal">
            <div className="suppliersTab-modalHeader">
              <h3>{editing ? "Edit Supplier" : "Add New Supplier"}</h3>
              <button
                className="suppliersTab-closeBtn"
                onClick={() => {
                  setShowSupplierModal(false);
                  resetForm();
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="suppliersTab-form">
              <div className="suppliersTab-formGrid">
                <div className="suppliersTab-formGroup">
                  <label>Supplier Name *</label>
                  <input
                    name="name"
                    placeholder="Enter supplier name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="suppliersTab-formGroup">
                  <label>Contact Person</label>
                  <input
                    name="contactPerson"
                    placeholder="Contact person name"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contactPerson: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="suppliersTab-formGroup">
                  <label>Phone</label>
                  <input
                    name="phone"
                    placeholder="Phone number"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>

                <div className="suppliersTab-formGroup">
                  <label>Email</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="Email address"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>

                <div className="suppliersTab-formGroup suppliersTab-fullWidth">
                  <label>Address</label>
                  <textarea
                    name="address"
                    placeholder="Full address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    rows="3"
                  />
                </div>
              </div>

              <div className="suppliersTab-formActions">
                <button
                  type="button"
                  className="suppliersTab-cancelBtn"
                  onClick={() => {
                    setShowSupplierModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="suppliersTab-saveBtn">
                  {editing ? "Update Supplier" : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products Modal */}
      {showProductsModal && selectedSupplier && (
        <div className="suppliersTab-modalOverlay">
          <div className="suppliersTab-modal suppliersTab-productsModal">
            <div className="suppliersTab-modalHeader">
              <h3>
                <FiPackage className="suppliersTab-modalIcon" />
                Products from {selectedSupplier.name}
              </h3>
              <button
                className="suppliersTab-closeBtn"
                onClick={() => {
                  setShowProductsModal(false);
                  setSelectedSupplier(null);
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="suppliersTab-modalContent">
              {/* Add Product Link Form */}
              <div className="suppliersTab-addProductSection">
                <h4>Add New Product</h4>
                <AddSupplierProduct
                  supplierId={selectedSupplier._id}
                  items={items}
                  supplierItems={getSupplierProducts(selectedSupplier._id)}
                  onAdd={handleAddLink}
                />
              </div>

              {/* Products List */}
              <div className="suppliersTab-productsList">
                <h4>
                  Current Products ({getProductsCount(selectedSupplier._id)})
                </h4>
                {getSupplierProducts(selectedSupplier._id).length === 0 ? (
                  <div className="suppliersTab-emptyProducts">
                    <FiPackage size={32} />
                    <p>No products linked to this supplier yet</p>
                  </div>
                ) : (
                  <div className="suppliersTab-productsTable">
                    <table>
                      <thead>
                        <tr>
                          <th>Product Name</th>
                          <th>Category</th>
                          <th>Price (₹)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSupplierProducts(selectedSupplier._id).map(
                          (link) => (
                            <SupplierProductRow
                              key={link._id}
                              link={link}
                              onUpdate={handleUpdateLink}
                              onRemove={handleRemoveLink}
                            />
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* COMPONENT: Supplier Product Row with Edit Functionality */
const SupplierProductRow = ({ link, onUpdate, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState(link.price || "");

  const handleSave = () => {
    if (!price || price <= 0) {
      alert("Price must be greater than 0");
      return;
    }
    onUpdate(link._id, parseFloat(price));
    setIsEditing(false);
  };

  const handleCancel = () => {
    setPrice(link.price || "");
    setIsEditing(false);
  };

  return (
    <tr className="suppliersTab-productRow">
      <td className="suppliersTab-productName">
        <strong>{link.item?.name || "—"}</strong>
        {link.item?.description && (
          <span className="suppliersTab-productDescription">
            {link.item.description}
          </span>
        )}
      </td>
      <td>
        <span
          className={`suppliersTab-categoryBadge suppliersTab-category-${
            link.item?.category?.toLowerCase().replace(" ", "-") || "other"
          }`}
        >
          {link.item?.category || "—"}
        </span>
      </td>
      <td className="suppliersTab-productPrice">
        {isEditing ? (
          <div className="suppliersTab-editPrice">
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="suppliersTab-priceInput"
            />
            <span className="suppliersTab-currency">₹</span>
          </div>
        ) : (
          <div className="suppliersTab-priceDisplay">
            ₹{parseFloat(link.price || 0).toLocaleString()}
          </div>
        )}
      </td>
      <td className="suppliersTab-actionButtons">
        {isEditing ? (
          <>
            <button
              className="suppliersTab-saveBtn suppliersTab-smallBtn"
              onClick={handleSave}
              title="Save price"
            >
              <FiSave />
            </button>
            <button
              className="suppliersTab-cancelBtn suppliersTab-smallBtn"
              onClick={handleCancel}
              title="Cancel"
            >
              <FiX />
            </button>
          </>
        ) : (
          <>
            <button
              className="suppliersTab-editBtn"
              onClick={() => setIsEditing(true)}
              title="Edit price"
            >
              <FiEdit />
            </button>
            <button
              className="suppliersTab-deleteBtn"
              onClick={() => onRemove(link._id)}
              title="Remove product"
            >
              <FiTrash2 />
            </button>
          </>
        )}
      </td>
    </tr>
  );
};

/* COMPONENT: Add Supplier Product */
const AddSupplierProduct = ({ supplierId, items, supplierItems, onAdd }) => {
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");

  // Get items not already linked to this supplier
  const availableItems = items.filter(
    (item) => !supplierItems.some((link) => link.item?._id === item._id)
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!item || !price) return alert("All fields are required");
    if (price <= 0) return alert("Price must be greater than 0");

    onAdd(supplierId, item, price);
    setItem("");
    setPrice("");
  };

  return (
    <form onSubmit={handleSubmit} className="suppliersTab-addProductForm">
      <div className="suppliersTab-addProductGrid">
        <div className="suppliersTab-formGroup">
          <select
            value={item}
            onChange={(e) => setItem(e.target.value)}
            required
          >
            <option value="">Select Product</option>
            {availableItems.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name} ({item.category})
              </option>
            ))}
          </select>
        </div>

        <div className="suppliersTab-formGroup">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Price (₹)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div className="suppliersTab-formGroup">
          <button
            type="submit"
            className="suppliersTab-saveBtn suppliersTab-smallBtn"
            disabled={availableItems.length === 0}
          >
            <FiPlus /> Add Product
          </button>
        </div>
      </div>
      {availableItems.length === 0 && (
        <p className="suppliersTab-noItemsText">
          All available products are already linked to this supplier
        </p>
      )}
    </form>
  );
};

export default SuppliersTab;
