import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
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
  getProfile,
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

import { useBranch } from "../../context/BranchContext";
import "../../styles/SuppliersTab.css";

const SuppliersTab = () => {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [supplierItems, setSupplierItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [branches, setBranches] = useState([]);
  const { selectedBranch } = useBranch();

  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    branch: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      const [suppliersData, itemsData, supplierItemsData] = await Promise.all([
        getSuppliers({ branch: selectedBranch }),
        getInventoryItems(),
        getSupplierItems({ branch: selectedBranch }),
      ]);

      setSuppliers(suppliersData);
      setItems(itemsData);
      setSupplierItems(supplierItemsData);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranch]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await getProfile();
        const { branches = [] } = response.data.user || {};
        setBranches(branches);
      } catch (error) {
      }
    };

    fetchBranches();
  }, []);


  const resetForm = () => {
    setFormData({
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      branch: "",
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
      alert(t("suppliers.error_save"));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("suppliers.confirm_delete"))) return;
    try {
      await deleteSupplier(id);
      fetchData();
    } catch (err) {
      alert(t("suppliers.error_delete"));
    }
  };

  const handleAddLink = async (supplierId, itemId, price) => {
    try {
      await createSupplierItem({ supplier: supplierId, item: itemId, price });
      fetchData();
    } catch (err) {
      alert(t("suppliers.error_add_link"));
    }
  };

  const handleUpdateLink = async (linkId, price) => {
    try {
      await updateSupplierItem(linkId, { price });
      fetchData();
    } catch (err) {
      alert(t("suppliers.error_update_price"));
    }
  };

  const handleRemoveLink = async (linkId) => {
    if (!window.confirm(t("suppliers.confirm_remove_link"))) return;
    try {
      await deleteSupplierItem(linkId);
      fetchData();
    } catch (err) {
      alert(t("suppliers.error_remove_link"));
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
      branch: supplier.branch?.name || supplier.branch || "",
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
        <p>{t("suppliers.loading")}</p>
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
              <h1>{t("suppliers.title")}</h1>
              <p>{t("suppliers.subtitle")}</p>
            </div>
          </div>
          <button
            className="suppliersTab-addBtn"
            onClick={() => {
              resetForm();
              setShowSupplierModal(true);
            }}
          >
            <FiPlus size={18} /> {t("suppliers.add_supplier")}
          </button>
        </div>
      </div>

      {/* Suppliers Content */}
      <div className="suppliersTab-content">
        <div className="suppliersTab-sectionHeader">
          <h3>{t("suppliers.directory")}</h3>
          <span className="suppliersTab-subtitle">
            {t("suppliers.all_suppliers_products")}
          </span>
        </div>

        {suppliers.length === 0 ? (
          <div className="suppliersTab-emptyState">
            <FiTruck size={64} />
            <h4>{t("suppliers.no_suppliers_found")}</h4>
            <p>{t("suppliers.get_started_message")}</p>
            <button
              className="suppliersTab-primaryBtnn"
              onClick={() => setShowSupplierModal(true)}
            >
              <FiPlus /> {t("suppliers.add_first_supplier")}
            </button>
          </div>
        ) : (
          <div className="suppliersTab-tableContainer">
            <table className="suppliersTab-table">
              <thead>
                <tr>
                  <th>{t("suppliers.table.supplier_name")}</th>
                  <th>{t("suppliers.table.contact_person")}</th>
                  <th>{t("suppliers.table.phone")}</th>
                  <th>{t("suppliers.table.email")}</th>
                  <th>{t("suppliers.table.total_products")}</th>
                  <th>{t("suppliers.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const productsCount = getProductsCount(supplier._id);
                  return (
                    <tr key={supplier._id} className="suppliersTab-tableRow">
                      <td className="suppliersTab-supplierName">
                        <strong>{supplier.name}</strong>
                        {supplier.branch && (
                          <span className="suppliersTab-addressLine">
                            <FiMapPin size={12} />
                            {supplier.branch}
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
                            {t("suppliers.products_count", {
                              count: productsCount,
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="suppliersTab-actionButtons">
                        <button
                          className="suppliersTab-viewBtn"
                          onClick={() => openProductsModal(supplier)}
                          title={t("suppliers.view_products")}
                        >
                          <FiEye />
                        </button>
                        <button
                          className="suppliersTab-editBtn"
                          onClick={() => openEditModal(supplier)}
                          title={t("suppliers.edit_supplier")}
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="suppliersTab-deleteBtn"
                          onClick={() => handleDelete(supplier._id)}
                          title={t("suppliers.delete_supplier")}
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
      {showSupplierModal && createPortal(
        <div className="suppliersTab-modalOverlay">
          <div className="suppliersTab-modal">
            <div className="suppliersTab-modalHeader">
              <h3>
                {editing
                  ? t("suppliers.edit_supplier")
                  : t("suppliers.add_new_supplier")}
              </h3>
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
                  <label>{t("suppliers.form.supplier_name")} *</label>
                  <input
                    name="name"
                    placeholder={t("suppliers.form.supplier_name_placeholder")}
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="suppliersTab-formGroup">
                  <label>{t("suppliers.form.contact_person")}</label>
                  <input
                    name="contactPerson"
                    placeholder={t("suppliers.form.contact_person_placeholder")}
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
                  <label>{t("suppliers.form.phone")}</label>
                  <input
                    name="phone"
                    placeholder={t("suppliers.form.phone_placeholder")}
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>

                <div className="suppliersTab-formGroup">
                  <label>{t("suppliers.form.email")}</label>
                  <input
                    name="email"
                    type="email"
                    placeholder={t("suppliers.form.email_placeholder")}
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>

                <div className="suppliersTab-formGroup suppliersTab-fullWidth">
                  <label>{t("suppliers.form.address")}</label>
                  <textarea
                    name="address"
                    placeholder={t("suppliers.form.address_placeholder")}
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    rows="3"
                  />
                </div>

                <div className="suppliersTab-formGroup">
                  <label>{t("suppliers.form.branch")}</label>
                  <select
                    name="branch"
                    value={formData.branch}
                    onChange={(e) =>
                      setFormData({ ...formData, branch: e.target.value })
                    }
                    required
                  >
                    <option value="">
                      {t("suppliers.form.select_branch")}
                    </option>
                    {branches.map((branch, index) => {
                      const branchName =
                        typeof branch === "string" ? branch : branch.name;
                      return (
                        <option key={index} value={branchName}>
                          {branchName}
                        </option>
                      );
                    })}
                  </select>
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
                  {t("suppliers.cancel")}
                </button>
                <button type="submit" className="suppliersTab-saveBtn">
                  {editing
                    ? t("suppliers.update_supplier")
                    : t("suppliers.save_supplier")}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* Products Modal */}
      {showProductsModal && selectedSupplier && createPortal(
        <div className="suppliersTab-modalOverlay">
          <div className="suppliersTab-modal suppliersTab-productsModal">
            <div className="suppliersTab-modalHeader">
              <h3>
                <FiPackage className="suppliersTab-modalIcon" />
                {t("suppliers.products_from_supplier", {
                  supplier: selectedSupplier.name,
                })}
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
                <h4>{t("suppliers.add_new_product")}</h4>
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
                  {t("suppliers.current_products", {
                    count: getProductsCount(selectedSupplier._id),
                  })}
                </h4>
                {getSupplierProducts(selectedSupplier._id).length === 0 ? (
                  <div className="suppliersTab-emptyProducts">
                    <FiPackage size={32} />
                    <p>{t("suppliers.no_products_linked")}</p>
                  </div>
                ) : (
                  <div className="suppliersTab-productsTable">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("suppliers.table.product_name")}</th>
                          <th>{t("suppliers.table.category")}</th>
                          <th>{t("suppliers.table.price")}</th>
                          <th>{t("suppliers.table.actions")}</th>
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
      , document.body)}
    </div>
  );
};

/* COMPONENT: Supplier Product Row with Edit Functionality */
const SupplierProductRow = ({ link, onUpdate, onRemove }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState(link.price || "");

  const handleSave = () => {
    if (!price || price <= 0) {
      alert(t("suppliers.price_must_be_positive"));
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
            <span className="suppliersTab-currency">₽</span>
          </div>
        ) : (
          <div className="suppliersTab-priceDisplay">
            ₽{parseFloat(link.price || 0).toLocaleString()}
          </div>
        )}
      </td>
      <td className="suppliersTab-actionButtons">
        {isEditing ? (
          <>
            <button
              className="suppliersTab-saveBtn suppliersTab-smallBtn"
              onClick={handleSave}
              title={t("suppliers.save_price")}
            >
              <FiSave />
            </button>
            <button
              className="suppliersTab-cancelBtn suppliersTab-smallBtn"
              onClick={handleCancel}
              title={t("suppliers.cancel")}
            >
              <FiX />
            </button>
          </>
        ) : (
          <>
            <button
              className="suppliersTab-editBtn"
              onClick={() => setIsEditing(true)}
              title={t("suppliers.edit_price")}
            >
              <FiEdit />
            </button>
            <button
              className="suppliersTab-deleteBtn"
              onClick={() => onRemove(link._id)}
              title={t("suppliers.remove_product")}
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
  const { t } = useTranslation();
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");

  // Get items not already linked to this supplier
  const availableItems = items.filter(
    (item) => !supplierItems.some((link) => link.item?._id === item._id)
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!item || !price) return alert(t("suppliers.all_fields_required"));
    if (price <= 0) return alert(t("suppliers.price_must_be_positive"));

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
            <option value="">{t("suppliers.select_product")}</option>
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
            placeholder={t("suppliers.price_placeholder")}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div className="suppliersTab-formGroup">
          <button
            type="submit"
            className="suppliersTab-saveBtn suppliersTab-smallBtnn"
            disabled={availableItems.length === 0}
          >
            <FiPlus /> {t("suppliers.add_product")}
          </button>
        </div>
      </div>
      {availableItems.length === 0 && (
        <p className="suppliersTab-noItemsText">
          {t("suppliers.all_products_linked")}
        </p>
      )}
    </form>
  );
};

export default SuppliersTab;
