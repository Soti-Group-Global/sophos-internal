import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { XCircle, ArrowRight, RefreshCw, Copy } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { getEarlyDetectionBookings, generateEDPaymentLink } from "../utils/api";
import "../styles/EarlyDetectionPayment.css";

const EarlyDetectionPaymentFailed = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get("bookingId");
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) {
        setLoading(false);
        return;
      }

      try {
        const res = await getEarlyDetectionBookings();
        const list = res?.data || res?.bookings || [];
        const foundBooking = Array.isArray(list)
          ? list.find((b) => b._id === bookingId)
          : null;

        if (foundBooking) {
          setBooking(foundBooking);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  const handleRetryPayment = async () => {
    if (!bookingId) {
      toast.error("Booking ID not found");
      return;
    }

    setRetrying(true);
    try {
      const response = await generateEDPaymentLink(bookingId);
      
      if (response.success && response.data?.paymentLink) {
        // Redirect to payment link
        window.location.href = response.data.paymentLink;
      } else {
        toast.error("Failed to generate payment link. Please contact support.");
      }
    } catch (error) {
      toast.error("Failed to retry payment. Please contact support.");
    } finally {
      setRetrying(false);
    }
  };

  const handleCopyBookingNumber = () => {
    if (booking?.bookingNumber) {
      navigator.clipboard.writeText(booking.bookingNumber);
      toast.success(t("earlyDiagnosis.paymentResult.failed.bookingNumberCopied"));
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(t("language") === "English" ? "en-US" : "ru-RU", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="payment-result-page">
        <div className="payment-result-container">
          <div className="loading-spinner"></div>
          <p>{t("earlyDiagnosis.paymentResult.failed.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-page">
      <div className="payment-result-container">
        <div className="payment-result-icon failed">
          <XCircle size={80} />
        </div>

        <h1 className="payment-result-title">{t("earlyDiagnosis.paymentResult.failed.title")}</h1>
        <p className="payment-result-message">
          {t("earlyDiagnosis.paymentResult.failed.message")}
        </p>

        {booking && (
          <div className="booking-details-card">
            <h2>{t("earlyDiagnosis.paymentResult.failed.bookingDetails")}</h2>
            
            <div className="detail-row">
              <span className="detail-label">{t("earlyDiagnosis.paymentResult.failed.bookingNumber")}:</span>
              <div className="detail-value-with-action">
                <span className="detail-value">{booking.bookingNumber}</span>
                <button
                  className="copy-btn-small"
                  onClick={handleCopyBookingNumber}
                  title={t("earlyDiagnosis.paymentResult.failed.bookingNumberCopied")}
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-label">{t("earlyDiagnosis.paymentResult.failed.package")}:</span>
              <span className="detail-value">{booking.package?.name || "N/A"}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">{t("earlyDiagnosis.paymentResult.failed.amount")}:</span>
              <span className="detail-value highlight">
                {(booking.package?.price || 0).toLocaleString()} ₽
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">{t("earlyDiagnosis.paymentResult.failed.appointmentDate")}:</span>
              <span className="detail-value">
                {formatDate(booking.appointmentDate)} at {booking.appointmentTime || "09:00"}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">{t("earlyDiagnosis.paymentResult.failed.status")}:</span>
              <span className="status-badge failed">{t("earlyDiagnosis.paymentResult.failed.statusFailed")}</span>
            </div>
          </div>
        )}

        {!booking && bookingId && (
          <div className="info-message warning">
            <p>Booking ID: {bookingId}</p>
            <p>{t("earlyDiagnosis.paymentResult.failed.bookingNotFound")}</p>
          </div>
        )}

        <div className="payment-result-actions">
          {booking && (
            <button
              className="btn-primary"
              onClick={handleRetryPayment}
              disabled={retrying}
            >
              {retrying ? (
                <>
                  <RefreshCw size={18} className="spinning" />
                  {t("earlyDiagnosis.paymentResult.failed.generatingPaymentLink")}
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  {t("earlyDiagnosis.paymentResult.failed.retryPayment")}
                </>
              )}
            </button>
          )}
          
          <button
            className="btn-secondary"
            onClick={() => navigate("/early-detection-bookings")}
          >
            {t("earlyDiagnosis.paymentResult.failed.goToHome")}
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="payment-result-footer">
          <p>{t("earlyDiagnosis.paymentResult.failed.support")}</p>
          <p className="support-note">
            {t("earlyDiagnosis.paymentResult.failed.supportNote")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EarlyDetectionPaymentFailed;
