import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { getStocks, updateStockQuantity, deleteStock } from "../../utils/api";
import {
  FiEdit,
  FiTrash2,
  FiRefreshCcw,
  FiPackage,
  FiCalendar,
  FiMapPin,
  FiTruck,
  FiPlus,
  FiMinus,
  FiX,
} from "react-icons/fi";
import { useBranch } from "../../context/BranchContext";
import "../../styles/StocksTab.css";
import SearchBar from "../SearchBar/SearchBar";

const StocksTab = () => {
  const { t } = useTranslation();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustType, setAdjustType] = useState("set"); // "set", "add", "subtract"
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLocation, setFilterLocation] = useState("All");
  const { selectedBranch } = useBranch();

useEffect(() => {
    fetchStocks(selectedBranch || "All");
  }, [selectedBranch]);

 const fetchStocks = async (branchName = "All") => {
    setLoading(true);

    try {

      const data = await getStocks({ branch: branchName });
      setStocks(data);
    } catch (err) {
    }

    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('stocks.confirm_delete')))
      return;
    try {
      await deleteStock(id);
      fetchStocks();
    } catch (err) {
      alert(t('stocks.error_delete'));
    }
  };

  const handleAdjustQuantity = async (stockId) => {
    if (adjustQty === 0 && adjustType === "set") {
      alert(t('stocks.enter_valid_quantity'));
      return;
    }

    try {
      let finalQuantity = adjustQty;

      if (adjustType === "add") {
        const currentStock = stocks.find((s) => s._id === stockId);
        finalQuantity = (currentStock?.quantity || 0) + adjustQty;
      } else if (adjustType === "subtract") {
        const currentStock = stocks.find((s) => s._id === stockId);
        finalQuantity = (currentStock?.quantity || 0) - adjustQty;
        if (finalQuantity < 0) {
          alert(t('stocks.cannot_below_zero'));
          return;
        }
      }

      await updateStockQuantity(stockId, finalQuantity);
      setSelectedStock(null);
      setAdjustQty(0);
      setAdjustType("set");
      fetchStocks();
    } catch (err) {
      alert(t('stocks.error_update_quantity'));
    }
  };

  // Filter stocks based on search and location
  const filteredStocks = stocks.filter((stock) => {
    const matchesSearch =
      stock.item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLocation =
      filterLocation === "All" || stock.location === filterLocation;

    return matchesSearch && matchesLocation;
  });

  // Get unique locations for filter
  const locations = [
    "All",
    ...new Set(stocks.map((stock) => stock.location).filter(Boolean)),
  ];

  // Calculate total stock value and low stock items
  const totalItems = stocks.length;
  const totalQuantity = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
  const lowStockItems = stocks.filter((stock) => stock.quantity < 10).length;

  if (loading) {
    return (
      <div className="stocksTab-loading">
        <div className="stocksTab-spinner"></div>
        <p>{t('stocks.loading')}</p>
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
              <h1>{t('stocks.title')}</h1>
              <p>{t('stocks.subtitle')}</p>
            </div>
          </div>
          <button className="stocksTab-refreshBtn" onClick={fetchStocks}>
            <FiRefreshCcw size={18} /> {t('stocks.refresh')}
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
            <span className="stocksTab-statLabel">{t('stocks.total_items')}</span>
          </div>
        </div>
        <div className="stocksTab-statCard">
          <div className="stocksTab-statIcon stocksTab-statQuantity">
            <FiPlus size={20} />
          </div>
          <div className="stocksTab-statInfo">
            <span className="stocksTab-statNumber">{totalQuantity}</span>
            <span className="stocksTab-statLabel">{t('stocks.total_quantity')}</span>
          </div>
        </div>
        <div className="stocksTab-statCard">
          <div className="stocksTab-statIcon stocksTab-statLow">
            <FiMinus size={20} />
          </div>
          <div className="stocksTab-statInfo">
            <span className="stocksTab-statNumber">{lowStockItems}</span>
            <span className="stocksTab-statLabel">{t('stocks.low_stock')}</span>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="stocksTab-controls">
        <SearchBar
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('stocks.search_placeholder')}
        />
        <div className="stocksTab-filters">
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="stocksTab-locationFilter"
          >
            {locations.map((location) => (
              <option key={location} value={location}>
                {location === "All" ? t('stocks.all_locations') : location}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stocks Table */}
      <div className="stocksTab-content">
        <div className="stocksTab-sectionHeader">
          <h3>{t('stocks.stock_records', { count: filteredStocks.length })}</h3>
          <span className="stocksTab-subtitle">
            {t('stocks.all_stock_in_one_place')}
          </span>
        </div>

        {filteredStocks.length === 0 ? (
          <div className="stocksTab-emptyState">
            <FiPackage size={64} />
            <h4>{t('stocks.no_stock_records')}</h4>
            <p>
              {stocks.length === 0
                ? t('stocks.no_stock_available')
                : t('stocks.adjust_search_criteria')}
            </p>
          </div>
        ) : (
          <div className="stocksTab-tableContainer">
            <table className="stocksTab-table">
              <thead>
                <tr>
                  <th>{t('stocks.table.item_name')}</th>
                  <th>{t('stocks.table.expiry_date')}</th>
                  <th>{t('stocks.table.quantity')}</th>
                  <th>{t('stocks.table.location')}</th>
                  <th>{t('stocks.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map((stock) => {
                  const isExpired =
                    stock.expiryDate && new Date(stock.expiryDate) < new Date();
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
                          <div
                            className={`stocksTab-expiry ${
                              isExpired ? "stocksTab-expired" : ""
                            }`}
                          >
                            <FiCalendar size={14} />
                            {new Date(stock.expiryDate).toLocaleDateString()}
                            {isExpired && (
                              <span className="stocksTab-expiryBadge">
                                {t('stocks.expired')}
                              </span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="stocksTab-quantityCell">
                        <div
                          className={`stocksTab-quantity ${
                            isLowStock ? "stocksTab-lowStock" : ""
                          }`}
                        >
                          <span className="stocksTab-qtyNumber">
                            {stock.quantity}
                          </span>
                          {isLowStock && (
                            <span className="stocksTab-lowStockBadge">
                              {t('stocks.low')}
                            </span>
                          )}
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
                          title={t('stocks.adjust_quantity')}
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="stocksTab-deleteBtn"
                          onClick={() => handleDelete(stock._id)}
                          title={t('stocks.delete_stock_record')}
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
      {selectedStock && createPortal(
        <div className="stocksTab-modalOverlay">
          <div className="stocksTab-modal">
            <div className="stocksTab-modalHeader">
              <h3>{t('stocks.adjust_stock_quantity')}</h3>
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
                  <label>{t('stocks.adjustment_type')}</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="stocksTab-adjustType"
                  >
                    <option value="set">{t('stocks.set_exact_quantity')}</option>
                    <option value="add">{t('stocks.add_quantity')}</option>
                    <option value="subtract">{t('stocks.subtract_quantity')}</option>
                  </select>
                </div>

                <div className="stocksTab-formGroup">
                  <label>
                    {adjustType === "set"
                      ? t('stocks.new_quantity')
                      : adjustType === "add"
                      ? t('stocks.quantity_to_add')
                      : t('stocks.quantity_to_subtract')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Number(e.target.value))}
                    placeholder={
                      adjustType === "set"
                        ? t('stocks.enter_new_quantity')
                        : adjustType === "add"
                        ? t('stocks.enter_quantity_to_add')
                        : t('stocks.enter_quantity_to_subtract')
                    }
                    className="stocksTab-quantityInput"
                  />
                </div>

                {adjustType !== "set" && (
                  <div className="stocksTab-preview">
                    <span className="stocksTab-previewLabel">
                      {t('stocks.current_quantity')}:{" "}
                      {stocks.find((s) => s._id === selectedStock)?.quantity ||
                        0}
                    </span>
                    <span className="stocksTab-previewValue">
                      {t('stocks.new_quantity')}:{" "}
                      {adjustType === "add"
                        ? (stocks.find((s) => s._id === selectedStock)
                            ?.quantity || 0) + adjustQty
                        : (stocks.find((s) => s._id === selectedStock)
                            ?.quantity || 0) - adjustQty}
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
                  {t('stocks.cancel')}
                </button>
                <button
                  type="button"
                  className="stocksTab-saveBtn"
                  onClick={() => handleAdjustQuantity(selectedStock)}
                >
                  {t('stocks.update_quantity')}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default StocksTab;