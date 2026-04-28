import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiCheckCircle, FiAlertCircle, FiDownload, FiEye } from 'react-icons/fi';
import './Orders.css';

const TestResultModal = ({
  order,
  onClose,
  handleOrderApproval,
  handleResultApproval,
  handleAssignVendor,
  handleView,
  handleDownload,
  vendors,
  applicationDetails,
}) => {
  const { t } = useTranslation();

  const formatDateTime = (dateString) =>
    new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getIncompleteTestsCount = (order) =>
    order.tests.filter((t) => !t.resultFileId).length;

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'completed';
      case 'ordered':
        return 'pending';
      case 'waiting for assign':
        return 'pending';
      case 'cancelled':
        return 'cancelled';
      case 'completed & waiting for approve':
        return 'waiting-approval';
      default:
        return 'pending';
    }
  };

  return (
    <div className="orders-modal-overlay" onClick={onClose}>
      <div
        className="orders-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="orders-modal-header">
          <div className="orders-modal-title-section">
            <h2>{t('orders.orderDetails')}</h2>
            <span className="orders-modal-order-id">#{order.orderId || t('orders.unassigned')}</span>
          </div>
          <button className="orders-modal-close" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <div className="orders-modal-body">
          <div className="orders-order-details-grid">
            <div className="orders-detail-item">
              <span className="orders-detail-label">{t('orders.orderDate')}</span>
              <span className="orders-detail-value">
                {formatDateTime(order.createdAt)}
              </span>
            </div>
            <div className="orders-detail-item">
              <span className="orders-detail-label">{t('orders.patientName')}</span>
              <span className="orders-detail-value">
                {applicationDetails[order.tests[0].appointmentId]?.patientName || t('orders.unknown_patient')}
              </span>
            </div>
            <div className="orders-detail-item">
              <span className="orders-detail-label">{t('orders.appointmentDate')}</span>
              <span className="orders-detail-value">
                {applicationDetails[order.tests[0].appointmentId]?.appointmentDate || t('orders.na')}
              </span>
            </div>
          </div>

          <div className="orders-modal-tests-section">
            <div className="orders-tests-section-header">
              <h3>{t('orders.testResults')} ({order.tests.length})</h3>
              <div className="orders-tests-summary">
                <span className="orders-completed-tests">
                  {order.tests.filter((t) => t.resultFileId).length} {t('orders.completed')}
                </span>
                <span className="orders-pending-tests">
                  {getIncompleteTestsCount(order)} {t('orders.pending')}
                </span>
              </div>
            </div>

            <div className="orders-modal-tests-grid">
              {order.tests.map((test, index) => (
                <div
                  key={index}
                  className={`orders-modal-test-card ${getStatusClass(test.status)}`}
                >
                  <div className="orders-modal-test-header">
                    <div className="orders-modal-test-name">
                      {test.testName}
                    </div>
                    <span
                      className={`orders-modal-result-badge ${getStatusClass(test.status)}`}
                    >
                      {test.status || t('orders.na')}
                    </span>
                  </div>

                  <div className="orders-modal-test-actions">
                    {test.resultFileId ? (
                      <div className="orders-result-actions">
                        <span className="orders-upload-date">
                          {t('orders.uploaded')}: {formatDateTime(test.uploadedAt)}
                        </span>
                        <div className="orders-button-group">
                          {(test.status === 'Completed & waiting for approve') && (
                            <button
                              className="orders-text-button orders-primary"
                              onClick={() => handleResultApproval(test._id, test.status)}
                            >
                              {t('orders.approveResult')}
                            </button>
                          )}
                          <button
                            className="orders-download-btn"
                            onClick={() => handleDownload(test.resultFileId, test.testName)}
                          >
                            <FiDownload size={16} />
                            <span>{t('orders.download')}</span>
                          </button>
                          <button
                            className="orders-view-btn"
                            onClick={() => handleView(test.resultFileId)}
                          >
                            <FiEye size={16} />
                            <span>{t('orders.view')}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="orders-result-actions">
                        {test.status === 'Waiting for Assign' && (
                          <select
                            className="orders-vendor-select"
                            onChange={(e) => {
                              const [vendorId, vendorName] = e.target.value.split('|');
                              handleAssignVendor(test._id, vendorId, vendorName);
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>{t('orders.selectVendor')}</option>
                            {vendors.map(vendor => (
                              <option key={vendor._id} value={`${vendor._id}|${vendor.name}`}>
                                {vendor.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {test.status === 'Waiting for Assign' && (
                          <button
                            className="orders-text-button orders-primary"
                            onClick={() => handleOrderApproval(order.orderId, test._id, test.status)}
                          >
                            {t('orders.approveOrder')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestResultModal;