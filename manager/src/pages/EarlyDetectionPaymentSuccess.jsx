import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight, Copy } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { getEarlyDetectionBookings } from "../utils/api";
import "../styles/EarlyDetectionPayment.css";

const EarlyDetectionPaymentSuccess = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get("bookingId");
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleCopyBookingNumber = () => {
    if (booking?.bookingNumber) {
      navigator.clipboard.writeText(booking.bookingNumber);
      toast.success(t("earlyDiagnosis.paymentResult.success.bookingNumberCopied"));
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
          <p>{t("earlyDiagnosis.paymentResult.success.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-page">
      <div className="payment-result-container">
        <div className="payment-result-icon success">
          <CheckCircle size={80} />
        </div>

        <h1 className="payment-result-title">{t("earlyDiagnosis.paymentResult.success.title")}</h1>
        <p className="payment-result-message">
          {t("earlyDiagnosis.paymentResult.success.message")}
        </p>

        {booking && (
          <div className="booking-details-card">
            <h2>{t("earlyDiagnosis.paymentResult.success.bookingDetails")}</h2>
            
            <div className="detail-row">
              <span className="detail-label">{t("earlyDiagnosis.paymentResult.success.bookingNumber")}:</span>
              <div className="detail-value-with-action">
                <span className="detail-value">{booking.bookingNumber}</span>
                <button
                  className="copy-btn-small"
                  onClick={handleCopyBookingNumber}
                  title={t("earlyDiagnosis.paymentResult.success.bookingNumberCopied")}
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-label">{t("earlyDiagnosis.paymentResult.success.package")}:</span>
              <span className="detail-value">{booking.package?.name || "N/A"}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">{t("earlyDiagnosis.paymentResult.success.amountPaid")}:</span>
              <span className="detail-value highlight">
                {(booking.package?.price || 0).toLocaleString()} ₽
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">{t("earlyDiagnosis.paymentResult.success.appointmentDate")}:</span>
              <span className="detail-value">
                {formatDate(booking.appointmentDate)} at {booking.appointmentTime || "09:00"}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">{t("earlyDiagnosis.paymentResult.success.status")}:</span>
              <span className="status-badge success">{t("earlyDiagnosis.paymentResult.success.statusPaid")}</span>
            </div>
          </div>
        )}

        {!booking && bookingId && (
          <div className="info-message">
            <p>Booking ID: {bookingId}</p>
            <p>Please check your email for confirmation details.</p>
          </div>
        )}

        <div className="payment-result-actions">
          <button
            className="btn-primary"
            onClick={() => navigate("/early-detection-bookings")}
          >
            {t("earlyDiagnosis.paymentResult.success.goToHome")}
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="payment-result-footer">
          <p>{t("earlyDiagnosis.paymentResult.success.support")}</p>
        </div>
      </div>
    </div>
  );
};

export default EarlyDetectionPaymentSuccess;
