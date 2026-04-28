import React, { useState } from "react";
import { useTranslation } from "react-i18next";

// Import your tab components
import InventoryTab from "../components/Inventory/InventoryTab";
import SuppliersTab from "../components/Inventory/SuppliersTab";
import OrdersTab from "../components/Inventory/OrdersTab";
import StocksTab from "../components/Inventory/StocksTab";

import "../styles/InventoryManagement.css";
import StockRequestsTab from "../components/Inventory/StockRequestsTab";

const InventoryManagement = () => {
  const [activeTab, setActiveTab] = useState("inventory");
  const { t } = useTranslation();

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
        return <StockRequestsTab />;
      default:
        return <InventoryTab />;
    }
  };

  return (
    <div className="inventory-container">
      {/* Header */}
      <div className="inventory-header-bar">
        <h2 className="inventory-header">{t("inventory_management.header")}</h2>
      </div>

      {/* Navigation Tabs */}
      <div className="inventory-tabs">
        <button
          className={`inventory-tab ${
            activeTab === "inventory" ? "active" : ""
          }`}
          onClick={() => setActiveTab("inventory")}
        >
          {t("inventory_management.tabs.inventory")}
        </button>
        <button
          className={`inventory-tab ${
            activeTab === "suppliers" ? "active" : ""
          }`}
          onClick={() => setActiveTab("suppliers")}
        >
          {t("inventory_management.tabs.suppliers")}
        </button>
        <button
          className={`inventory-tab ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          {t("inventory_management.tabs.orders")}
        </button>
        <button
          className={`inventory-tab ${activeTab === "stocks" ? "active" : ""}`}
          onClick={() => setActiveTab("stocks")}
        >
          {t("inventory_management.tabs.stocks")}
        </button>
        <button
          className={`inventory-tab ${
            activeTab === "stock_requests" ? "active" : ""
          }`}
          onClick={() => setActiveTab("stock_requests")}
        >
          {t("inventory_management.tabs.stocksRequests")}
        </button>
      </div>

      {/* Dynamic Tab Content */}
      <div className="inventory-content">{renderTab()}</div>
    </div>
  );
};

export default InventoryManagement;
