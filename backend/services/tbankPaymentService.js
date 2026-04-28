const axios = require('axios');
const crypto = require('crypto');

/**
 * T-Bank (Tinkoff) Payment Service
 * API Documentation: https://developer.tbank.ru/eacq
 */
class TBankPaymentService {
  constructor() {
    // These should be moved to environment variables
    this.terminalKey = process.env.TBANK_TERMINAL_KEY || '';
    this.secretKey = process.env.TBANK_SECRET_KEY || '';
    this.baseUrl = process.env.TBANK_API_URL || 'https://securepay.tinkoff.ru/v2';
  }

  /**
   * Generate token for request authentication
   * @param {Object} params - Request parameters
   * @returns {string} - SHA-256 hash token
   */
  generateToken(params) {
    // Add Password (secret key) to params
    const tokenParams = {
      ...params,
      Password: this.secretKey
    };

    // Sort keys alphabetically
    const sortedKeys = Object.keys(tokenParams).sort();
    
    // Concatenate values
    const tokenString = sortedKeys
      .map(key => tokenParams[key])
      .join('');

    // Generate SHA-256 hash
    return crypto
      .createHash('sha256')
      .update(tokenString)
      .digest('hex');
  }

  /**
   * Verify webhook token
   * @param {Object} notification - Webhook notification object
   * @returns {boolean} - True if token is valid
   */
  verifyWebhookToken(notification) {
    const receivedToken = notification.Token;
    
    // Create params object without Token and nested objects (Data, Receipt)
    const params = {};
    for (const key in notification) {
      if (key !== 'Token' && typeof notification[key] !== 'object') {
        params[key] = notification[key];
      }
    }
    
    // Generate expected token
    const expectedToken = this.generateToken(params);
    
    return receivedToken === expectedToken;
  }

  /**
   * Initialize payment transaction
   * @param {Object} options
   * @param {number} options.amount - Amount in kopecks (1 RUB = 100 kopecks)
   * @param {string} options.orderId - Unique order identifier
   * @param {string} options.description - Payment description
   * @param {string} options.customerEmail - Customer email
   * @param {string} options.customerPhone - Customer phone
   * @param {Object} options.receipt - Fiscal receipt data (optional, required for 54-FZ)
   * @param {string} options.successUrl - URL to redirect after successful payment
   * @param {string} options.failUrl - URL to redirect after failed payment
   * @param {string} options.notificationUrl - URL for payment status notifications
   * @param {Object} options.data - Additional custom data
   * @param {Object} options.installment - Installment configuration (optional)
   * @param {string} options.language - Payment form language (ru or en)
   * @param {string} options.customerKey - Customer ID for saving cards
   * @param {boolean} options.recurrent - Enable card saving for future payments
   * @returns {Promise<Object>} - Payment initialization response
   */
  async initPayment(options) {
    const {
      amount,
      orderId,
      description,
      customerEmail,
      customerPhone,
      receipt,
      successUrl,
      failUrl,
      notificationUrl,
      data,
      installment,
      language = 'ru',
      customerKey,
      recurrent = false
    } = options;

    // Prepare request body according to T-Bank API documentation
    const requestBody = {
      TerminalKey: this.terminalKey,
      Amount: amount,
      OrderId: orderId,
      Description: description,
      Language: language,
      NotificationURL: notificationUrl,
      SuccessURL: successUrl,
      FailURL: failUrl
    };

    // Add CustomerKey if provided (needed for card saving and one-click payments)
    if (customerKey) {
      requestBody.CustomerKey = customerKey;
    }

    // Enable card saving for future payments
    if (recurrent) {
      requestBody.Recurrent = 'Y';
    }

    // Set PayType - always use 'O' for one-stage payment (auto-confirmation)
    // PayType 'O' enables all payment methods including installments (one-stage payment)
    requestBody.PayType = 'O';

    // Add DATA object with customer information
    if (customerEmail || customerPhone || data) {
      requestBody.DATA = {};
      
      if (customerEmail) {
        requestBody.DATA.Email = customerEmail;
      }
      
      if (customerPhone) {
        requestBody.DATA.Phone = customerPhone;
      }
      
      // Merge additional data
      if (data) {
        requestBody.DATA = {
          ...requestBody.DATA,
          ...data
        };
      }
    }

    // Add receipt for fiscal data (mandatory if online cash register is connected)
    if (receipt) {
      requestBody.Receipt = receipt;
    }

    // Generate token for authentication
    // According to T-Bank API: Include all non-object/array parameters except Token itself
    const tokenParams = {
      TerminalKey: this.terminalKey,
      Amount: amount,
      OrderId: orderId,
      Description: description
    };

    // Add NotificationURL, SuccessURL, FailURL to token
    if (notificationUrl) {
      tokenParams.NotificationURL = notificationUrl;
    }
    if (successUrl) {
      tokenParams.SuccessURL = successUrl;
    }
    if (failUrl) {
      tokenParams.FailURL = failUrl;
    }

    // Add PayType to token
    if (requestBody.PayType) {
      tokenParams.PayType = requestBody.PayType;
    }

    // Add CustomerKey to token
    if (requestBody.CustomerKey) {
      tokenParams.CustomerKey = requestBody.CustomerKey;
    }

    // Add Recurrent to token
    if (requestBody.Recurrent) {
      tokenParams.Recurrent = requestBody.Recurrent;
    }

    // Add Language to token
    if (language) {
      tokenParams.Language = language;
    }

    // Note: Receipt and DATA are complex objects and should NOT be included in token generation

    requestBody.Token = this.generateToken(tokenParams);

    try {
      

      const response = await axios.post(`${this.baseUrl}/Init`, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      

      return {
        success: response.data.Success,
        paymentId: response.data.PaymentId,
        paymentUrl: response.data.PaymentURL,
        status: response.data.Status,
        errorCode: response.data.ErrorCode,
        message: response.data.Message || response.data.Details
      };
    } catch (error) {
      return {
        success: false,
        errorCode: error.response?.data?.ErrorCode || 'NETWORK_ERROR',
        message: error.response?.data?.Message || error.message
      };
    }
  }

  /**
   * Get payment status
   * @param {string} paymentId - Payment ID from init response
   * @returns {Promise<Object>} - Payment status
   */
  async getPaymentState(paymentId) {
    const requestBody = {
      TerminalKey: this.terminalKey,
      PaymentId: paymentId
    };

    requestBody.Token = this.generateToken({
      TerminalKey: this.terminalKey,
      PaymentId: paymentId
    });

    try {
      const response = await axios.post(`${this.baseUrl}/GetState`, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: response.data.Success,
        paymentId: response.data.PaymentId,
        orderId: response.data.OrderId,
        status: response.data.Status,
        amount: response.data.Amount,
        errorCode: response.data.ErrorCode,
        message: response.data.Message
      };
    } catch (error) {
      throw new Error(`Failed to get payment state: ${error.response?.data?.Message || error.message}`);
    }
  }

  /**
   * Confirm payment (capture funds for two-stage payment)
   * @param {string} paymentId - Payment ID to confirm
   * @param {number} amount - Amount in kopecks (optional, uses original amount if not specified)
   * @returns {Promise<Object>} - Confirmation result
   */
  async confirmPayment(paymentId, amount = null) {
    const requestBody = {
      TerminalKey: this.terminalKey,
      PaymentId: paymentId
    };

    // Add amount if specified (for partial confirmation)
    if (amount) {
      requestBody.Amount = amount;
    }

    // Generate token
    const tokenParams = {
      TerminalKey: this.terminalKey,
      PaymentId: paymentId
    };
    if (amount) {
      tokenParams.Amount = amount;
    }

    requestBody.Token = this.generateToken(tokenParams);

    try {
      

      const response = await axios.post(`${this.baseUrl}/Confirm`, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      

      return {
        success: response.data.Success,
        paymentId: response.data.PaymentId,
        status: response.data.Status,
        errorCode: response.data.ErrorCode,
        message: response.data.Message
      };
    } catch (error) {
      return {
        success: false,
        errorCode: error.response?.data?.ErrorCode || 'NETWORK_ERROR',
        message: error.response?.data?.Message || error.message
      };
    }
  }

  /**
   * Cancel payment
   * @param {string} paymentId - Payment ID to cancel
   * @returns {Promise<Object>} - Cancellation result
   */
  async cancelPayment(paymentId) {
    const requestBody = {
      TerminalKey: this.terminalKey,
      PaymentId: paymentId
    };

    requestBody.Token = this.generateToken({
      TerminalKey: this.terminalKey,
      PaymentId: paymentId
    });

    try {
      const response = await axios.post(`${this.baseUrl}/Cancel`, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: response.data.Success,
        paymentId: response.data.PaymentId,
        status: response.data.Status,
        errorCode: response.data.ErrorCode,
        message: response.data.Message
      };
    } catch (error) {
      throw new Error(`Failed to cancel payment: ${error.response?.data?.Message || error.message}`);
    }
  }

  /**
   * Verify webhook notification signature
   * @param {Object} notification - Webhook notification data
   * @returns {boolean} - True if signature is valid
   */
  verifyNotification(notification) {
    const { Token: receivedToken, ...params } = notification;
    const calculatedToken = this.generateToken(params);
    return calculatedToken === receivedToken;
  }

  /**
   * Generate receipt for fiscal data (54-FZ compliance)
   * @param {Object} options
   * @param {string} options.email - Customer email
   * @param {string} options.phone - Customer phone
   * @param {Array} options.items - Array of items
   * @param {string} options.taxation - Taxation system
   * @returns {Object} - Receipt object
   */
  generateReceipt(options) {
    const {
      email,
      phone,
      items,
      taxation = 'usn_income' // Simplified taxation system
    } = options;

    return {
      Email: email,
      Phone: phone,
      Taxation: taxation,
      Items: items.map(item => ({
        Name: item.name,
        Price: item.price, // Price per unit in kopecks
        Quantity: item.quantity || 1,
        Amount: item.amount, // Total amount in kopecks
        Tax: item.tax || 'none',
        PaymentMethod: item.paymentMethod || 'full_prepayment',
        PaymentObject: item.paymentObject || 'service'
      }))
    };
  }

  /**
   * Calculate installment plan details
   * @param {Object} options
   * @param {number} options.totalAmount - Total amount in kopecks
   * @param {number} options.months - Number of months (3, 6, 12, etc.)
   * @param {Date} options.startDate - Start date for installments
   * @returns {Object} - Installment plan details
   */
  calculateInstallmentPlan(options) {
    const { totalAmount, months, startDate = new Date() } = options;

    if (!totalAmount || !months) {
      throw new Error('Total amount and months are required');
    }

    const monthlyPayment = Math.ceil(totalAmount / months);
    const payments = [];
    const start = new Date(startDate);

    for (let i = 0; i < months; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(start.getMonth() + i + 1);

      payments.push({
        paymentNumber: i + 1,
        amount: i === months - 1 
          ? totalAmount - (monthlyPayment * (months - 1)) // Last payment adjusts for rounding
          : monthlyPayment,
        dueDate: dueDate,
        status: 'pending'
      });
    }

    return {
      totalAmount,
      monthlyPayment,
      numberOfPayments: months,
      payments,
      firstPaymentDate: payments[0].dueDate,
      lastPaymentDate: payments[payments.length - 1].dueDate
    };
  }
}

module.exports = new TBankPaymentService();
