import React, { useState } from "react";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

// Import your tab components
import InventoryTab from "../components/Inventory/InventoryTab";
import SuppliersTab from "../components/Inventory/SuppliersTab";
import OrdersTab from "../components/Inventory/OrdersTab";
import StocksTab from "../components/Inventory/StocksTab";

import "../styles/InventoryManagement.css"; // optional styling
import StockRequestsTab from "../components/Inventory/StockRequestsTab";

const InventoryManagement = () => {
  const [activeTab, setActiveTab] = useState("inventory");

  const renderTab = () => {
    switch (activeTab) {
      case "inventory":
        return <InventoryTab />;
      case "suppliers":
        return <SuppliersTab />;
      case "orders":
        return <OrdersTab />;
      case "stocks":
        return <StocksTab />;
      case "stock_requests":
        return <StockRequestsTab />
      default:
        return <InventoryTab />;
    }
  };

  return (
    <div className="inventory-container">
      <ToastContainer position="top-right" autoClose={2000} />
      {/* Header */}
      <div className="inventory-header-bar">
        <h2 className="inventory-header">Inventory Management Dashboard</h2>
      </div>

      {/* Navigation Tabs */}
      <div className="inventory-tabs">
        <button
          className={`inventory-tab ${activeTab === "inventory" ? "active" : ""}`}
          onClick={() => setActiveTab("inventory")}
        >
          Inventory
        </button>
        <button
          className={`inventory-tab ${activeTab === "suppliers" ? "active" : ""}`}
          onClick={() => setActiveTab("suppliers")}
        >
          Suppliers
        </button>
        <button
          className={`inventory-tab ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          Orders
        </button>
        <button
          className={`inventory-tab ${activeTab === "stocks" ? "active" : ""}`}
          onClick={() => setActiveTab("stocks")}
        >
          Stocks
        </button>
        <button
          className={`inventory-tab ${activeTab === "stock_requests" ? "active" : ""}`}
          onClick={() => setActiveTab("stock_requests")}
        >
          Stock Requests
        </button>
      </div>

      {/* Dynamic Tab Content */}
      <div className="inventory-content">{renderTab()}</div>
    </div>
  );
};

export default InventoryManagement;
