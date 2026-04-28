import React, { useState } from 'react';

const Payment = ({ formData, updateFormData, prevStep, onSubmit }) => {
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    agreeToTerms: false
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPaymentInfo(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      updateFormData({ paymentInfo });
      onSubmit();
      setIsProcessing(false);
    }, 2000);
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    return parts.length ? parts.join(' ') : value;
  };

  const handleCardNumberChange = (e) => {
    const formattedValue = formatCardNumber(e.target.value);
    setPaymentInfo(prev => ({
      ...prev,
      cardNumber: formattedValue
    }));
  };

  return (
    <div className="step-container">
      <h2>Payment Information</h2>
      
      <div className="order-summary">
        <h3>Order Summary</h3>
        <div className="summary-item">
          <span>Package:</span>
          <span>{formData.selectedPackage.name} - ${formData.selectedPackage.price}</span>
        </div>
        <div className="summary-total">
          <span>Total:</span>
          <span>${formData.selectedPackage.price}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="payment-form">
        <div className="form-group">
          <label htmlFor="cardholderName">Cardholder Name</label>
          <input
            type="text"
            id="cardholderName"
            name="cardholderName"
            value={paymentInfo.cardholderName}
            onChange={handleInputChange}
            placeholder="Enter cardholder name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="cardNumber">Card Number</label>
          <input
            type="text"
            id="cardNumber"
            name="cardNumber"
            value={paymentInfo.cardNumber}
            onChange={handleCardNumberChange}
            placeholder="1234 5678 9012 3456"
            maxLength="19"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="expiryDate">Expiry Date</label>
            <input
              type="text"
              id="expiryDate"
              name="expiryDate"
              value={paymentInfo.expiryDate}
              onChange={handleInputChange}
              placeholder="MM/YY"
              maxLength="5"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cvv">CVV</label>
            <input
              type="text"
              id="cvv"
              name="cvv"
              value={paymentInfo.cvv}
              onChange={handleInputChange}
              placeholder="123"
              maxLength="3"
              required
            />
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              name="agreeToTerms"
              checked={paymentInfo.agreeToTerms}
              onChange={handleInputChange}
              required
            />
            I agree to the terms and conditions
          </label>
        </div>

        <div className="form-navigation">
          <button type="button" onClick={prevStep} className="back-btn">
            Back
          </button>
          <button 
            type="submit" 
            className="submit-btn"
            disabled={isProcessing || !paymentInfo.agreeToTerms}
          >
            {isProcessing ? 'Processing...' : `Pay $${formData.selectedPackage.price}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Payment;