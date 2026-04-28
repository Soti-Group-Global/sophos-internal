import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { getResultsByLink, getCorporateByLink } from "../utils/api";
import "../styles/CorporateResults.css";

const CorporateResults = () => {
  const { link } = useParams();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [corporate, setCorporate] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Verify password against the corporate record
      const corpRes = await getCorporateByLink(link);
      const corp = corpRes.data;

      if (!corp) {
        toast.error("Form not found");
        setLoading(false);
        return;
      }

      // Password check: compare submitted password with stored one
      if (corp.password !== password) {
        toast.error("Invalid password");
        setLoading(false);
        return;
      }

      const res = await getResultsByLink(link);
      setCorporate(res);
      setSubmissions(res.data || []);
      setAuthenticated(true);
    } catch {
      toast.error("Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!authenticated) {
    return (
      <div className="cr-page">
        <div className="cr-login-card">
          <div className="cr-logo">SOPHОS</div>
          <h2>Results Access</h2>
          <p>Enter your password to view registration results</p>
          <form onSubmit={handleLogin} className="cr-login-form">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="cr-password-input"
              autoFocus
            />
            <button type="submit" className="cr-login-btn" disabled={loading}>
              {loading ? "Checking..." : "View Results"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="cr-page">
      <div className="cr-results-wrapper">
        {/* Header */}
        <div className="cr-results-header">
          <div>
            <h1>{corporate.corporateName}</h1>
            <p className="cr-results-meta">
              {submissions.length} registration{submissions.length !== 1 ? "s" : ""}
              {corporate.discountPercentage > 0 && (
                <span className="cr-discount-badge">{corporate.discountPercentage}% discount applied</span>
              )}
            </p>
          </div>
        </div>

        {/* Table */}
        {submissions.length === 0 ? (
          <div className="cr-empty">No registrations yet.</div>
        ) : (
          <div className="cr-table-wrapper">
            <table className="cr-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Coupon Code</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s, i) => (
                  <tr key={s._id}>
                    <td>{i + 1}</td>
                    <td>{[s.lastName, s.firstName, s.middleName].filter(Boolean).join(" ")}</td>
                    <td>{s.email}</td>
                    <td>{s.phone || "—"}</td>
                    <td><span className="cr-coupon">{s.couponCode}</span></td>
                    <td>{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CorporateResults;
