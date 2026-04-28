import React, { useEffect, useState } from "react";
import {
  getStocks,
  updateStockQuantity,
  deleteStock
} from "../../utils/api";
import { FiEdit, FiTrash2, FiRefreshCcw, FiPackage, FiCalendar, FiMapPin, FiTruck, FiPlus, FiMinus, FiX } from "react-icons/fi";
import "../../styles/StocksTab.css";

const StocksTab = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustType, setAdjustType] = useState("set"); // "set", "add", "subtract"
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLocation, setFilterLocation] = useState("All");

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const data = await getStocks();
      setStocks(data);
    } catch (err) {
      console.error("Error fetching stocks:", err);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this stock record?")) return;
    try {
      await deleteStock(id);
      fetchStocks();
    } catch (err) {
      console.error(err);
      alert("Failed to delete stock!");
    }
  };

  const handleAdjustQuantity = async (stockId) => {
    if (adjustQty === 0 && adjustType === "set") {
      alert("Please enter a valid quantity to adjust.");
      return;
    }

    try {
      let finalQuantity = adjustQty;
      
      if (adjustType === "add") {
        const currentStock = stocks.find(s => s._id === stockId);
        finalQuantity = (currentStock?.quantity || 0) + adjustQty;
      } else if (adjustType === "subtract") {
        const currentStock = stocks.find(s => s._id === stockId);
        finalQuantity = (currentStock?.quantity || 0) - adjustQty;
        if (finalQuantity < 0) {
          alert("Cannot set quantity below zero!");
          return;
        }
      }

      await updateStockQuantity(stockId, finalQuantity);
      setSelectedStock(null);
      setAdjustQty(0);
      setAdjustType("set");
      fetchStocks();
    } catch (err) {
      console.error(err);
      alert("Failed to update stock quantity.");
    }
  };

  // Filter stocks based on search and location
  const filteredStocks = stocks.filter(stock => {
    const matchesSearch = stock.item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         stock.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         stock.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLocation = filterLocation === "All" || stock.location === filterLocation;
    
    return matchesSearch && matchesLocation;
  });

  // Get unique locations for filter
  const locations = ["All", ...new Set(stocks.map(stock => stock.location).filter(Boolean))];

  // Calculate total stock value and low stock items
  const totalItems = stocks.length;
  const totalQuantity = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
  const lowStockItems = stocks.filter(stock => stock.quantity < 10).length;

  if (loading) {
    return (
      <div className="stocksTab-loading">
        <div className="stocksTab-spinner"></div>
        <p>Loading stock data...</p>
      </div>
    );
  }

  return (
    <div className="stocksTab-container">
      {/* Header Section */}
      <div className="stocksTab-header">
        <div className="stocksTab-headerContent">
          <div className="stocksTab-titleSection">
            <div className="stocksTab-iconWrapper">
              <FiPackage size={24} />
            </div>
            <div>
              <h1>Stock Management</h1>
              <p>Monitor and manage your inventory stock levels</p>
            </div>
          </div>
          <button
            className="stocksTab-refreshBtn"
            onClick={fetchStocks}
          >
            <FiRefreshCcw size={18} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stocksTab-stats">
        <div className="stocksTab-statCard">
          <div className="stocksTab-statIcon stocksTab-statTotal">
            <FiPackage size={20} />
          </div>
          <div className="stocksTab-statInfo">
            <span className="stocksTab-statNumber">{totalItems}</span>
            <span className="stocksTab-statLabel">Total Items</span>
          </div>
        </div>
        <div className="stocksTab-statCard">
          <div className="stocksTab-statIcon stocksTab-statQuantity">
            <FiPlus size={20} />
          </div>
          <div className="stocksTab-statInfo">
            <span className="stocksTab-statNumber">{totalQuantity}</span>
            <span className="stocksTab-statLabel">Total Quantity</span>
          </div>
        </div>
        <div className="stocksTab-statCard">
          <div className="stocksTab-statIcon stocksTab-statLow">
            <FiMinus size={20} />
          </div>
          <div className="stocksTab-statInfo">
            <span className="stocksTab-statNumber">{lowStockItems}</span>
            <span className="stocksTab-statLabel">Low Stock</span>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="stocksTab-controls">
        <div className="stocksTab-searchBox">
          <input
            type="text"
            placeholder="Search by item name, batch, or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="stocksTab-filters">
          <select 
            value={filterLocation} 
            onChange={(e) => setFilterLocation(e.target.value)}
            className="stocksTab-locationFilter"
          >
            {locations.map(location => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stocks Table */}
      <div className="stocksTab-content">
        <div className="stocksTab-sectionHeader">
          <h3>Stock Records ({filteredStocks.length})</h3>
          <span className="stocksTab-subtitle">All your inventory stock in one place</span>
        </div>

        {filteredStocks.length === 0 ? (
          <div className="stocksTab-emptyState">
            <FiPackage size={64} />
            <h4>No stock records found</h4>
            <p>
              {stocks.length === 0 
                ? "No stock records available yet."
                : "Try adjusting your search or filter criteria."
              }
            </p>
          </div>
        ) : (
          <div className="stocksTab-tableContainer">
            <table className="stocksTab-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Expiry Date</th>
                  <th>Quantity</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map((stock) => {
                  const isExpired = stock.expiryDate && new Date(stock.expiryDate) < new Date();
                  const isLowStock = stock.quantity < 10;
                  
                  return (
                    <tr key={stock._id} className="stocksTab-tableRow">
                      <td className="stocksTab-itemCell">
                        <strong>{stock.item?.name || "—"}</strong>
                        {stock.item?.category && (
                          <span className="stocksTab-itemCategory">
                            {stock.item.category}
                          </span>
                        )}
                      </td>
                     
                      <td className="stocksTab-expiryCell">
                        {stock.expiryDate ? (
                          <div className={`stocksTab-expiry ${isExpired ? 'stocksTab-expired' : ''}`}>
                            <FiCalendar size={14} />
                            {new Date(stock.expiryDate).toLocaleDateString()}
                            {isExpired && <span className="stocksTab-expiryBadge">Expired</span>}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="stocksTab-quantityCell">
                        <div className={`stocksTab-quantity ${isLowStock ? 'stocksTab-lowStock' : ''}`}>
                          <span className="stocksTab-qtyNumber">{stock.quantity}</span>
                          {isLowStock && <span className="stocksTab-lowStockBadge">Low</span>}
                        </div>
                      </td>
                      <td>
                        <div className="stocksTab-location">
                          <FiMapPin size={14} />
                          {stock.location}
                        </div>
                      </td>
                    
                      <td className="stocksTab-actionButtons">
                        <button
                          className="stocksTab-editBtn"
                          onClick={() => {
                            setSelectedStock(stock._id);
                            setAdjustQty(stock.quantity);
                            setAdjustType("set");
                          }}
                          title="Adjust quantity"
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="stocksTab-deleteBtn"
                          onClick={() => handleDelete(stock._id)}
                          title="Delete stock record"
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

      {/* Adjust Quantity Modal */}
      {selectedStock && (
        <div className="stocksTab-modalOverlay">
          <div className="stocksTab-modal">
            <div className="stocksTab-modalHeader">
              <h3>Adjust Stock Quantity</h3>
              <button 
                className="stocksTab-closeBtn" 
                onClick={() => {
                  setSelectedStock(null);
                  setAdjustQty(0);
                  setAdjustType("set");
                }}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <div className="stocksTab-modalContent">
              <div className="stocksTab-adjustForm">
                <div className="stocksTab-formGroup">
                  <label>Adjustment Type</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="stocksTab-adjustType"
                  >
                    <option value="set">Set Exact Quantity</option>
                    <option value="add">Add Quantity</option>
                    <option value="subtract">Subtract Quantity</option>
                  </select>
                </div>

                <div className="stocksTab-formGroup">
                  <label>
                    {adjustType === "set" ? "New Quantity" : 
                     adjustType === "add" ? "Quantity to Add" : 
                     "Quantity to Subtract"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Number(e.target.value))}
                    placeholder={`Enter ${adjustType === "set" ? "new" : adjustType} quantity`}
                    className="stocksTab-quantityInput"
                  />
                </div>

                {adjustType !== "set" && (
                  <div className="stocksTab-preview">
                    <span className="stocksTab-previewLabel">
                      Current Quantity: {
                        stocks.find(s => s._id === selectedStock)?.quantity || 0
                      }
                    </span>
                    <span className="stocksTab-previewValue">
                      New Quantity: {
                        adjustType === "add" 
                          ? (stocks.find(s => s._id === selectedStock)?.quantity || 0) + adjustQty
                          : (stocks.find(s => s._id === selectedStock)?.quantity || 0) - adjustQty
                      }
                    </span>
                  </div>
                )}
              </div>
              
              <div className="stocksTab-formActions">
                <button 
                  type="button" 
                  className="stocksTab-cancelBtn"
                  onClick={() => {
                    setSelectedStock(null);
                    setAdjustQty(0);
                    setAdjustType("set");
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="stocksTab-saveBtn"
                  onClick={() => handleAdjustQuantity(selectedStock)}
                >
                  Update Quantity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StocksTab;