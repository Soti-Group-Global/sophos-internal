import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "../../utils/api";
import {
  FiEdit,
  FiTrash2,
  FiPlus,
  FiX,
  FiPackage,
  FiSearch,
} from "react-icons/fi";
import "../../styles/InventoryTab.css";

const InventoryTab = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = [
    "All",
    "Medicine",
    "Consumable",
    "Equipment",
    "Lab Supply",
    "Other",
  ];
  const units = [
    "pcs",
    "ml",
    "mg",
    "g",
    "kg",
    "L",
    "box",
    "bottle",
    "pack",
    "unit",
  ];

  const [formData, setFormData] = useState({
    name: "",
    category: "Medicine",
    sku: "",
    description: "",
    unit: "pcs",
    manufacturer: "",
    reorderLevel: 10,
  });

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory]);

  const filterProducts = () => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== "All") {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    setFilteredProducts(filtered);
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getInventoryItems();
      setProducts(data);
    } catch (err) {
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "Medicine",
      sku: "",
      description: "",
      unit: "pcs",
      manufacturer: "",
      reorderLevel: 10,
    });
    setEditingItem(null);
  };

  const handleInputChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) await updateInventoryItem(editingItem._id, formData);
      else await createInventoryItem(formData);
      fetchItems();
      setShowModal(false);
      resetForm();
    } catch (err) {
      alert(t('inventory.error_save'));
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('inventory.confirm_delete')))
      return;
    try {
      await deleteInventoryItem(id);
      fetchItems();
    } catch (err) {
      alert(t('inventory.error_delete'));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  if (loading)
    return (
      <div className="inventoryTab-loading">
        <div className="inventoryTab-spinner"></div>
        <p>{t('inventory.loading')}</p>
      </div>
    );

  return (
    <div className="inventoryTab-container">
      {/* Header Section */}
      <div className="inventoryTab-header">
        <div className="inventoryTab-headerContent">
          <div className="inventoryTab-titleSection">
            <div className="inventoryTab-iconWrapper">
              <FiPackage size={24} />
            </div>
            <div>
              <h1>{t('inventory.title')}</h1>
              <p>{t('inventory.subtitle')}</p>
            </div>
          </div>
          <button
            className="inventoryTab-addBtn"
            onClick={() => setShowModal(true)}
          >
            <FiPlus size={18} /> {t('inventory.add_new_item')}
          </button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="inventoryTab-searchSection">
        <div className="inventoryTab-searchBox">
          <FiSearch className="inventoryTab-searchIcon" />
          <input
            type="text"
            placeholder={t('inventory.search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="inventoryTab-filterControls">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="inventoryTab-categoryFilter"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {t(`inventory.categories.${category.toLowerCase().replace(' ', '_')}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products List */}
      <div className="inventoryTab-productsSection">
        <div className="inventoryTab-sectionHeader">
          <h3>{t('inventory.items_count', { count: filteredProducts.length })}</h3>
          <span className="inventoryTab-subtitle">
            {t('inventory.items_subtitle')}
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="inventoryTab-emptyState">
            <FiPackage size={64} />
            <h4>{t('inventory.no_items_found')}</h4>
            <p>
              {products.length === 0
                ? t('inventory.get_started_message')
                : t('inventory.adjust_search_message')}
            </p>
            {products.length === 0 && (
              <button
                className="inventoryTab-addBtn inventoryTab-primaryBtn"
                onClick={() => setShowModal(true)}
              >
                <FiPlus /> {t('inventory.add_first_item')}
              </button>
            )}
          </div>
        ) : (
          <div className="inventoryTab-tableContainer">
            <table className="inventoryTab-table">
              <thead>
                <tr>
                  <th>{t('inventory.table.product_name')}</th>
                  <th>{t('inventory.table.category')}</th>
                  <th>{t('inventory.table.sku')}</th>
                  <th>{t('inventory.table.unit')}</th>
                  <th>{t('inventory.table.manufacturer')}</th>
                  <th>{t('inventory.table.reorder_level')}</th>
                  <th>{t('inventory.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product._id} className="inventoryTab-tableRow">
                    <td className="inventoryTab-productName">
                      <strong>{product.name}</strong>
                      {product.description && (
                        <span className="inventoryTab-productDescription">
                          {product.description}
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`inventoryTab-categoryBadge inventoryTab-category-${product.category
                          .toLowerCase()
                          .replace(" ", "-")}`}
                      >
                        {t(`inventory.categories.${product.category.toLowerCase().replace(' ', '_')}`)}
                      </span>
                    </td>
                    <td className="inventoryTab-sku">{product.sku || "—"}</td>
                    <td>
                      <span className="inventoryTab-unitBadge">
                        {t(`inventory.units.${product.unit}`)}
                      </span>
                    </td>
                    <td>{product.manufacturer || "—"}</td>
                    <td>
                      <span className="inventoryTab-reorderLevel">
                        {product.reorderLevel}
                      </span>
                    </td>
                    <td className="inventoryTab-actionButtons">
                      <button
                        className="inventoryTab-editBtn"
                        onClick={() => handleEdit(product)}
                        title={t('inventory.edit_item')}
                      >
                        <FiEdit />
                      </button>
                      <button
                        className="inventoryTab-deleteBtn"
                        onClick={() => handleDelete(product._id)}
                        title={t('inventory.delete_item')}
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

      {/* Modal for Add/Edit */}
      {showModal && createPortal(
        <div className="inventoryTab-modalOverlay">
          <div className="inventoryTab-modal">
            <div className="inventoryTab-modalHeader">
              <h3>{editingItem ? t('inventory.edit_item') : t('inventory.add_new_item')}</h3>
              <button className="inventoryTab-closeBtn" onClick={closeModal}>
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="inventoryTab-form">
              <div className="inventoryTab-formGrid">
                <div className="inventoryTab-formGroup">
                  <label>{t('inventory.form.product_name')} *</label>
                  <input
                    name="name"
                    placeholder={t('inventory.form.product_name_placeholder')}
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="inventoryTab-formGroup">
                  <label>{t('inventory.form.category')}</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                  >
                    {categories.filter(cat => cat !== 'All').map((category) => (
                      <option key={category} value={category}>
                        {t(`inventory.categories.${category.toLowerCase().replace(' ', '_')}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inventoryTab-formGroup">
                  <label>{t('inventory.form.sku')}</label>
                  <input
                    name="sku"
                    placeholder={t('inventory.form.sku_placeholder')}
                    value={formData.sku}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="inventoryTab-formGroup">
                  <label>{t('inventory.form.unit')}</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {t(`inventory.units.${unit}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inventoryTab-formGroup">
                  <label>{t('inventory.form.manufacturer')}</label>
                  <input
                    name="manufacturer"
                    placeholder={t('inventory.form.manufacturer_placeholder')}
                    value={formData.manufacturer}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="inventoryTab-formGroup">
                  <label>{t('inventory.form.reorder_level')}</label>
                  <input
                    name="reorderLevel"
                    type="number"
                    placeholder={t('inventory.form.reorder_level_placeholder')}
                    value={formData.reorderLevel}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
              </div>

              <div className="inventoryTab-formGroup inventoryTab-fullWidth">
                <label>{t('inventory.form.description')}</label>
                <textarea
                  name="description"
                  placeholder={t('inventory.form.description_placeholder')}
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                ></textarea>
              </div>

              <div className="inventoryTab-formActions">
                <button
                  type="button"
                  className="inventoryTab-cancelBtn"
                  onClick={closeModal}
                >
                  {t('inventory.cancel')}
                </button>
                <button type="submit" className="inventoryTab-saveBtn">
                  {editingItem ? t('inventory.update_item') : t('inventory.save_item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default InventoryTab;