import React, { useEffect, useState } from "react";
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "../../utils/api";
import { FiEdit, FiTrash2, FiPlus, FiX, FiPackage, FiSearch } from "react-icons/fi";
import RichTextEditor from "../RichTextEditor/RichTextEditor";
import "../../styles/InventoryTab.css";

const InventoryTab = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  const categories = ["All", "Medicine", "Consumable", "Equipment", "Lab Supply", "Other"];
  const units = ["pcs", "ml", "mg", "g", "kg", "L", "box", "bottle", "pack", "unit"];

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
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory !== "All") {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    setFilteredProducts(filtered);
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getInventoryItems();
      setProducts(data);
    } catch (err) {
      console.error("Error fetching inventory:", err);
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
      alert("Error saving product");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteInventoryItem(id);
      fetchItems();
    } catch (err) {
      alert("Error deleting product");
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
        <p>Loading inventory...</p>
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
              <h1>Inventory Management</h1>
              <p>Manage your medical supplies and equipment</p>
            </div>
          </div>
          <button
            className="inventoryTab-addBtn"
            onClick={() => setShowModal(true)}
          >
            <FiPlus size={18} /> Add New Item
          </button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="inventoryTab-searchSection">
        <div className="inventoryTab-searchBox">
          <FiSearch className="inventoryTab-searchIcon" />
          <input
            type="text"
            placeholder="Search by name, SKU, or manufacturer..."
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
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products List */}
      <div className="inventoryTab-productsSection">
        <div className="inventoryTab-sectionHeader">
          <h3>Inventory Items ({filteredProducts.length})</h3>
          <span className="inventoryTab-subtitle">All your medical supplies in one place</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="inventoryTab-emptyState">
            <FiPackage size={64} />
            <h4>No inventory items found</h4>
            <p>
              {products.length === 0 
                ? "Get started by adding your first inventory item."
                : "Try adjusting your search or filter criteria."
              }
            </p>
            {products.length === 0 && (
              <button className="inventoryTab-addBtn inventoryTab-primaryBtn" onClick={() => setShowModal(true)}>
                <FiPlus /> Add your first item
              </button>
            )}
          </div>
        ) : (
          <div className="inventoryTab-tableContainer">
            <table className="inventoryTab-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>SKU</th>
                  <th>Unit</th>
                  <th>Manufacturer</th>
                  <th>Reorder Level</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product._id} className="inventoryTab-tableRow">
                    <td className="inventoryTab-productName">
                      <strong>{product.name}</strong>
                      {product.description && (
                        <span className="inventoryTab-productDescription">{product.description}</span>
                      )}
                    </td>
                    <td>
                      <span className={`inventoryTab-categoryBadge inventoryTab-category-${product.category.toLowerCase().replace(' ', '-')}`}>
                        {product.category}
                      </span>
                    </td>
                    <td className="inventoryTab-sku">{product.sku || "—"}</td>
                    <td>
                      <span className="inventoryTab-unitBadge">{product.unit}</span>
                    </td>
                    <td>{product.manufacturer || "—"}</td>
                    <td>
                      <span className="inventoryTab-reorderLevel">{product.reorderLevel}</span>
                    </td>
                    <td className="inventoryTab-actionButtons">
                      <button
                        className="inventoryTab-editBtn"
                        onClick={() => handleEdit(product)}
                        title="Edit item"
                      >
                        <FiEdit />
                      </button>
                      <button
                        className="inventoryTab-deleteBtn"
                        onClick={() => handleDelete(product._id)}
                        title="Delete item"
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
      {showModal && (
        <div className="inventoryTab-modalOverlay">
          <div className="inventoryTab-modal">
            <div className="inventoryTab-modalHeader">
              <h3>{editingItem ? "Edit Item" : "Add New Item"}</h3>
              <button className="inventoryTab-closeBtn" onClick={closeModal}>
                <FiX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="inventoryTab-form">
              <div className="inventoryTab-formGrid">
                <div className="inventoryTab-formGroup">
                  <label>Product Name *</label>
                  <input
                    name="name"
                    placeholder="Enter product name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="inventoryTab-formGroup">
                  <label>Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                  >
                    <option value="Medicine">Medicine</option>
                    <option value="Consumable">Consumable</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Lab Supply">Lab Supply</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div className="inventoryTab-formGroup">
                  <label>SKU</label>
                  <input
                    name="sku"
                    placeholder="Stock Keeping Unit"
                    value={formData.sku}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="inventoryTab-formGroup">
                  <label>Unit</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                  >
                    {units.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                
                <div className="inventoryTab-formGroup">
                  <label>Manufacturer</label>
                  <input
                    name="manufacturer"
                    placeholder="Manufacturer name"
                    value={formData.manufacturer}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="inventoryTab-formGroup">
                  <label>Reorder Level</label>
                  <input
                    name="reorderLevel"
                    type="number"
                    placeholder="Reorder level"
                    value={formData.reorderLevel}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
              </div>
              
              <div className="inventoryTab-formGroup inventoryTab-fullWidth">
                <label>Description</label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(html) =>
                    setFormData({ ...formData, description: html })
                  }
                  placeholder="Product description"
                />
              </div>
              
              <div className="inventoryTab-formActions">
                <button 
                  type="button" 
                  className="inventoryTab-cancelBtn"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button type="submit" className="inventoryTab-saveBtn">
                  {editingItem ? "Update Item" : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryTab;