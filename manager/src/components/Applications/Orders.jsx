import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToastContainer, toast } from 'react-toastify';
import Swal from 'sweetalert2';
import Modal from 'react-modal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FiPlus, FiCheckCircle, FiXCircle, FiClock, FiEye, FiDownload, FiArrowLeft, FiArrowRight, FiSquare, FiCheckSquare, FiSearch, FiFilter, FiCalendar, FiAlertCircle } from 'react-icons/fi';
import { getOrders, createBulkOrders, updateOrderStatus, getTestResultFile, getApplication, getAvailableTests, getVendors,getApplicationByAppointmentId } from '../../utils/api';
import './Orders.css';
import TestResultModal from './TestResultModal';

Modal.setAppElement('#root');

const Orders = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showTestModal, setShowTestModal] = useState(false);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [applicationId, setApplicationId] = useState('');
  const [vendors, setVendors] = useState([]);
  const [applicationDetails, setApplicationDetails] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const itemsPerPage = 10;

  const statusOptions = [
    { value: 'all', label: t('orders.allStatuses') || 'All Statuses' },
    { value: 'Ordered', label: t('orders.ordered') || 'Ordered' },
    { value: 'Completed', label: t('orders.completed') || 'Completed' },
    { value: 'Cancelled', label: t('orders.cancelled') || 'Cancelled' },
    { value: 'Waiting for Assign', label: t('orders.waitingForAssign') || 'Waiting for Assign' },
  ];

  // Fetch all orders
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getOrders({ page: currentPage, limit: itemsPerPage });
      const ordersData = Array.isArray(response) ? response : response.orders || [];
      const groupedOrders = groupOrdersByOrderId(ordersData);
      setOrders(groupedOrders);
      setFilteredOrders(groupedOrders);
      setTotalPages(response.totalPages || Math.ceil(ordersData.length / itemsPerPage));
      await fetchApplicationDetails(groupedOrders);
    } catch (err) {
      setError(t('orders.fetchError'));
      toast.error(t('orders.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  // Group orders by orderId
  const groupOrdersByOrderId = (orders) => {
    const grouped = {};
    orders.forEach(order => {
      const key = order.orderId || `unassigned-${order._id}`;
      if (!grouped[key]) {
        grouped[key] = {
          orderId: order.orderId || null,
          tests: [],
          createdAt: order.createdAt,
        };
      }
      grouped[key].tests.push({
        _id: order._id,
        testId: order.testId,
        testName: order.testName,
        status: order.status,
        resultFileId: order.resultFileId,
        uploadedAt: order.uploadedAt,
        vendorId: order.vendorId,
        vendorName: order.vendorName,
        appointmentId: order.appointmentId,
      });
    });
    return Object.values(grouped);
  };

  // Fetch application details for orders
const fetchApplicationDetails = async (groupedOrders) => {
  const details = {};

  // Collect only valid (non-empty) appointmentIds
  const uniqueApplicationIds = [...new Set(
    groupedOrders.flatMap(group => group.tests.map(test => test.appointmentId))
  )].filter(Boolean);


  for (const appId of uniqueApplicationIds) {
    try {
      const response = await getApplicationByAppointmentId(appId);

      if (!response || !response.data) {
        details[appId] = {
          patientName: t('orders.unknown_patient'),
          appointmentDate: t('orders.na'),
        };
        continue;
      }

      const app = response.data;
      details[appId] = {
        patientName: app.patient
          ? `${app.patient.firstName || ''} ${app.patient.lastName || ''}`.trim()
          : t('orders.unknown_patient'),
        appointmentDate: app.date
          ? new Date(app.date).toLocaleDateString()
          : t('orders.na'),
      };
    } catch (err) {
      details[appId] = {
        patientName: t('orders.unknown_patient'),
        appointmentDate: t('orders.na'),
      };
    }
  }

  setApplicationDetails(details);
};


  // Fetch available tests and vendors
  const fetchAvailableTestsAndVendors = async () => {
    try {
      const [testsResponse, vendorsResponse] = await Promise.all([
        getAvailableTests(),
        getVendors(),
      ]);
      setAvailableTests(testsResponse || []);
      setVendors(vendorsResponse.vendors || []);
    } catch (err) {
      setAvailableTests([]);
      setVendors([]);
      toast.error(t('orders.fetchTestsError'));
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [currentPage]);

  useEffect(() => {
    fetchAvailableTestsAndVendors();
  }, []);

  // Apply filters and search
  useEffect(() => {
    let result = [...orders];

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = result.filter(
        (order) =>
          order.orderId?.toLowerCase().includes(lowerSearchTerm) ||
          order.tests?.some((test) =>
            test.testName?.toLowerCase().includes(lowerSearchTerm)
          )
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((order) => {
        const testStatuses = order.tests.map((test) => test.status);
        if (statusFilter === 'Completed') {
          return testStatuses.every((status) => status === 'Completed');
        } else if (statusFilter === 'Ordered') {
          return testStatuses.some((status) => status === 'Ordered');
        } else if (statusFilter === 'Cancelled') {
          return testStatuses.some((status) => status === 'Cancelled');
        } else if (statusFilter === 'Waiting for Assign') {
          return testStatuses.some((status) => status === 'Waiting for Assign');
        }
        return false;
      });
    }

    setFilteredOrders(result);
  }, [searchTerm, statusFilter, orders]);

  // Handle test selection in modal
  const handleTestSelection = (testId, testName) => {
    setSelectedTests(prev => {
      const isSelected = prev.some(test => test.testId === testId);
      if (isSelected) {
        return prev.filter(test => test.testId !== testId);
      }
      return [...prev, { testId, testName, applicationId }];
    });
  };

  // Handle select all tests
  const handleSelectAllTests = () => {
    if (selectedTests.length === availableTests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(availableTests.map(test => ({
        testId: test._id,
        testName: test.name,
        applicationId,
      })));
    }
  };

  // Create bulk orders
  const handleAddTests = async () => {
    if (!applicationId.trim()) {
      toast.error(t('orders.applicationIdRequired'));
      return;
    }
    if (selectedTests.length === 0) {
      toast.error(t('orders.noTestsSelected'));
      return;
    }
    try {
      const ordersData = selectedTests.map(test => {
        const vendor = vendors.find(v => v.services?.some(s => s.tests?.includes(test.testId)));
        return {
          applicationId: test.applicationId,
          testId: test.testId,
          testName: test.testName,
          vendorId: vendor ? vendor._id : null,
          vendorName: vendor ? vendor.name : 'Unassigned',
        };
      });
      await createBulkOrders({ orders: ordersData });
      setShowTestModal(false);
      setSelectedTests([]);
      setApplicationId('');
      fetchOrders();
      toast.success(t('orders.testsAdded', { count: selectedTests.length }));
    } catch (err) {
      toast.error(t('orders.addTestsError'));
    }
  };

  // Handle order approval
  const handleOrderApproval = async (orderId, testId, currentStatus) => {
    const result = await Swal.fire({
      title: t('orders.approveOrderTitle'),
      text: t('orders.approveOrderText'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: t('orders.approve'),
      cancelButtonText: t('orders.deny'),
      reverseButtons: true,
    });

    const newStatus = result.isConfirmed ? 'Ordered' : 'Cancelled';
    if (result.isConfirmed || result.dismiss === Swal.DismissReason.cancel) {
      try {
        await updateOrderStatus(testId, newStatus);
        toast.success(t(`orders.${newStatus.toLowerCase()}Success`));
        fetchOrders();
        if (selectedOrder && selectedOrder.orderId === orderId) {
          const updated = orders.find(o => o.orderId === orderId);
          if (updated) setSelectedOrder(updated);
        }
      } catch (err) {
        toast.error(t('orders.updateStatusError'));
      }
    }
  };

  // Handle test result approval
  const handleResultApproval = async (testId, currentStatus) => {
    const result = await Swal.fire({
      title: t('orders.approveResultTitle'),
      text: t('orders.approveResultText'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: t('orders.approve'),
      cancelButtonText: t('orders.deny'),
      reverseButtons: true,
    });

    const newStatus = result.isConfirmed ? 'Completed' : 'Cancelled';
    if (result.isConfirmed || result.dismiss === Swal.DismissReason.cancel) {
      try {
        await updateOrderStatus(testId, newStatus);
        toast.success(t(`orders.${newStatus.toLowerCase()}Success`));
        fetchOrders();
        if (selectedOrder) {
          const updated = orders.find(o => o.orderId === selectedOrder.orderId);
          if (updated) setSelectedOrder(updated);
        }
      } catch (err) {
        toast.error(t('orders.updateStatusError'));
      }
    }
  };

  // Handle vendor assignment
  const handleAssignVendor = async (testId, vendorId, vendorName) => {
    try {
      await updateOrderStatus(testId, 'Waiting for Assign', { vendorId, vendorName });
      toast.success(t('orders.vendorAssigned'));
      fetchOrders();
      if (selectedOrder) {
        const updated = orders.find(o => o.orderId === selectedOrder.orderId);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      toast.error(t('orders.assignVendorError'));
    }
  };

  // View test result
  const viewTestResult = async (fileId) => {
    try {
      const response = await getTestResultFile(fileId);
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      toast.error(t('orders.viewResultError'));
    }
  };

  // Download test result
  const downloadTestResult = async (fileId, testName) => {
    try {
      const response = await getTestResultFile(fileId);
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${testName}_result.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      toast.error(t('orders.downloadResultError'));
    }
  };

  // Generate and download PDF
  const generateAndDownloadPDF = async () => {
    const element = document.getElementById('orders-grid');
    if (!element) return;
    element.style.display = 'block';
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('Orders.pdf');
    element.style.display = '';
  };

  // Pagination
  const renderPagination = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`orders-pagination-button ${currentPage === i ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }
    return (
      <div className="orders-pagination-container">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="orders-pagination-arrow"
        >
          <FiArrowLeft />
        </button>
        {pageNumbers}
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="orders-pagination-arrow"
        >
          <FiArrowRight />
        </button>
        <span className="orders-pagination-info">
          {t('orders.pagination_info', {
            start: (currentPage - 1) * itemsPerPage + 1,
            end: Math.min(currentPage * itemsPerPage, orders.length * itemsPerPage),
            total: totalPages * itemsPerPage,
          })}
        </span>
      </div>
    );
  };

  // Get status color and class
  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'status-completed';
      case 'ordered':
        return 'status-ordered';
      case 'waiting for assign':
        return 'status-waiting';
      case 'cancelled':
        return 'status-cancelled';
      case 'completed & waiting for approve':
        return 'status-waiting-approval';
      default:
        return 'status-default';
    }
  };

  const getCompletionPercentage = (order) => {
    if (!order.tests || order.tests.length === 0) return 0;
    const completed = order.tests.filter((test) => test.resultFileId).length;
    return Math.round((completed / order.tests.length) * 100);
  };

  const getIncompleteTestsCount = (order) => {
    if (!order.tests || order.tests.length === 0) return 0;
    return order.tests.filter((test) => !test.resultFileId).length;
  };

  const getDerivedOrderStatus = (order) => {
    if (!order.tests || order.tests.length === 0) return 'Ordered';
    const allCompleted = order.tests.every((test) => test.resultFileId);
    const noneCompleted = order.tests.every((test) => !test.resultFileId);
    if (allCompleted) return 'Completed';
    if (noneCompleted) return 'Ordered';
    return 'Partially Completed';
  };

  const openOrderModal = (order) => {
    setSelectedOrder(order);
    setShowTestModal(false);
  };

  const closeModal = () => {
    setSelectedOrder(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="orders-loading-container">
        <div className="orders-loading-spinner"></div>
        <p>{t('orders.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orders-error-container">
        <div className="orders-error-icon">⚠️</div>
        <p>{error}</p>
        <button className="orders-retry-button" onClick={fetchOrders}>
          {t('orders.tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="orders-header-section">
        <h2 className="orders-header-title">{t('orders.title')}</h2>
        <button
          className="orders-text-button orders-primary"
          onClick={() => setShowTestModal(true)}
          disabled={availableTests.length === 0}
        >
          <FiPlus size={18} /> {t('orders.addOrder')}
        </button>
      </div>

      <div className="orders-filters-section">
        <div className="orders-search-box">
          <FiSearch className="orders-search-icon" />
          <input
            type="text"
            placeholder={t('orders.searchPlaceholder') || 'Search by order ID or test name...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="orders-search-input"
          />
        </div>
        <div className="orders-filter-group">
          <FiFilter className="orders-filter-icon" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="orders-status-filter"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="orders-orders-container">
        <div className="orders-orders-header">
          <h2>{t('orders.ordersList')}</h2>
          <div className="orders-orders-count">
            <span className="orders-total-count">{filteredOrders.length}</span>
            <span className="orders-count-label">{t('orders.totalOrders')}</span>
          </div>
        </div>

        <div className="orders-orders-grid" id="orders-grid">
          {filteredOrders.length === 0 ? (
            <div className="orders-no-orders">
              <div className="orders-no-orders-icon">
                <FiSearch size={48} />
              </div>
              <h3>{t('orders.noOrders')}</h3>
              <p>{t('orders.noOrdersPrompt')}</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const completionPercentage = getCompletionPercentage(order);
              const incompleteCount = getIncompleteTestsCount(order);
              return (
                <div
                  key={order.orderId || `unassigned-${order.tests[0]._id}`}
                  className="orders-order-card"
                  onClick={() => openOrderModal(order)}
                >
                  <div className="orders-content">
                    <div className="orders-order-card-header">
                      <div className="orders-order-id">
                        <span className="orders-order-hash">#</span>
                        {order.orderId || t('orders.unassigned')}
                      </div>
                      <span
                        className={`orders-status-badge ${getStatusClass(getDerivedOrderStatus(order))}`}
                      >
                        {getDerivedOrderStatus(order)}
                      </span>
                    </div>

                    <div className="orders-order-card-body">
                      <div className="orders-order-meta">
                        <div className="orders-order-info-row">
                          <FiCalendar className="orders-info-icon" />
                          <div className="orders-info-content">
                            <label>{t('orders.orderDate')}</label>
                            <p>{formatDate(order.createdAt)}</p>
                          </div>
                        </div>
                        <div className="orders-order-info-row">
                          <div className="orders-info-content">
                            <label>{t('orders.patientName')}</label>
                            <p>{applicationDetails[order.tests[0].appointmentId]?.patientName || t('orders.unknown_patient')}</p>
                          </div>
                        </div>
                        <div className="orders-order-info-row">
                          <div className="orders-info-content">
                            <label>{t('orders.testsProgress')}</label>
                            <div className="orders-progress-info">
                              <span className="orders-progress-text">
                                {order.tests.filter((t) => t.resultFileId).length} of {order.tests.length} completed
                              </span>
                              <div className="orders-progress-bar">
                                <div
                                  className="orders-progress-fill"
                                  style={{ width: `${completionPercentage}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {incompleteCount > 0 && (
                        <div className="orders-incomplete-warning">
                          <FiAlertCircle size={14} />
                          <span>{incompleteCount} test(s) pending</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="orders-order-card-footer">
                    <button
                      className="orders-view-test-button"
                      title={t('orders.viewTestDetails')}
                      onClick={() => openOrderModal(order)}
                    >
                      <FiEye size={16} />
                      <span>{t('orders.viewTestDetails')}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {renderPagination()}
      </div>

      <Modal
        isOpen={showTestModal}
        onRequestClose={() => {
          setShowTestModal(false);
          setSelectedTests([]);
          setApplicationId('');
        }}
        contentLabel="Add Orders Modal"
        className="orders-modal"
        overlayClassName="orders-modal-overlay"
      >
        <div className="orders-modal-header">
          <h3 className="orders-modal-title">{t('orders.addOrder')}</h3>
          <button
            className="orders-select-all-button"
            onClick={handleSelectAllTests}
            disabled={availableTests.length === 0}
          >
            {selectedTests.length === availableTests.length && availableTests.length > 0 ? (
              <>
                <FiCheckSquare /> {t('orders.deselectAll')}
              </>
            ) : (
              <>
                <FiSquare /> {t('orders.selectAll')}
              </>
            )}
          </button>
        </div>
        <div className="orders-modal-content">
          <div className="orders-application-id-input">
            <label className="orders-application-id-label">{t('orders.applicationId')}</label>
            <input
              type="text"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              placeholder={t('orders.enterApplicationId')}
              className="orders-edit-textarea"
            />
          </div>
          {availableTests.length === 0 ? (
            <p>{t('orders.noTestsAvailable')}</p>
          ) : (
            <div className="orders-tests-list">
              {availableTests.map(test => (
                <div
                  key={test._id}
                  className={`orders-test-item ${selectedTests.some(t => t.testId === test._id) ? 'selected' : ''}`}
                  onClick={() => handleTestSelection(test._id, test.name)}
                >
                  <div className="orders-test-checkbox">
                    {selectedTests.some(t => t.testId === test._id) ? (
                      <FiCheckSquare />
                    ) : (
                      <FiSquare />
                    )}
                  </div>
                  <div className="orders-test-info">
                    <span className="orders-test-name">{test.name}</span>
                    {test.specialtyName && (
                      <span className="orders-test-specialty">{test.specialtyName}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="orders-selected-count">
            {t('orders.selectedCount', { count: selectedTests.length })}
          </div>
          <div className="orders-modal-actions">
            <button
              onClick={handleAddTests}
              className="orders-text-button orders-primary"
              disabled={selectedTests.length === 0 || !applicationId.trim()}
            >
              <FiPlus /> {t('orders.addSelectedTests')}
            </button>
            <button
              onClick={() => {
                setShowTestModal(false);
                setSelectedTests([]);
                setApplicationId('');
              }}
              className="orders-text-button orders-secondary"
            >
              <FiXCircle /> {t('orders.cancel')}
            </button>
          </div>
        </div>
      </Modal>

      {selectedOrder && (
        <TestResultModal
          order={selectedOrder}
          onClose={closeModal}
          handleOrderApproval={handleOrderApproval}
          handleResultApproval={handleResultApproval}
          handleAssignVendor={handleAssignVendor}
          handleView={viewTestResult}
          handleDownload={downloadTestResult}
          vendors={vendors}
          applicationDetails={applicationDetails}
        />
      )}
    </div>
  );
};

export default Orders;