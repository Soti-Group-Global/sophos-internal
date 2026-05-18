const EarlyDetectionBooking = require('../models/EarlyDetectionBooking');
const tbankPaymentService = require('../services/tbankPaymentService');

/**
 * T-Bank Payment Controller for Early Detection Bookings
 */

/**
 * Initialize T-Bank payment for a booking
 * @route POST /api/early-detection/payment/init
 * @access Public
 */
exports.initTBankPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Find the booking
    const booking = await EarlyDetectionBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if payment is already completed
    if (booking.payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This booking is already paid'
      });
    }

    // Check if there's already an active T-Bank payment
    if (booking.payment.tbank?.paymentId && booking.payment.status === 'processing') {
      return res.status(400).json({
        success: false,
        message: 'Payment is already in progress',
        paymentUrl: booking.payment.paymentLink,
        paymentId: booking.payment.tbank.paymentId
      });
    }

    // Prepare payment data - use totalAmount (package + add-ons) if available
    const totalPrice = booking.totalAmount || booking.package?.price || 0;
    const amountInKopecks = totalPrice * 100; // Convert rubles to kopecks
    const orderId = booking.bookingNumber || `ED-${booking._id}`;

    // Build description based on what was selected
    const tbkHasAddOns = booking.addOns && booking.addOns.length > 0;
    let description;
    if (tbkHasAddOns) {
      description = `Оплата за пакет "${booking.package.name}" + ${booking.addOns.length} доп. опций - Early Detection`;
    } else {
      description = `Оплата за пакет "${booking.package.name}" - Early Detection`;
    }

    // Prepare URLs (these should come from environment variables)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const successUrl = `${baseUrl}/early-detection/payment-success?bookingId=${booking._id}`;
    const failUrl = `${baseUrl}/early-detection/payment-failed?bookingId=${booking._id}`;
    const notificationUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/early-detection/payment/webhook`;

    // Build receipt items: base package + add-ons
    const receiptItems = [{
      name: booking.package.name,
      price: booking.package.price * 100,
      quantity: 1,
      amount: booking.package.price * 100,
      tax: 'none',
      paymentMethod: 'full_prepayment',
      paymentObject: 'service'
    }];
    if (tbkHasAddOns) {
      booking.addOns.forEach(addOn => {
        receiptItems.push({
          name: addOn.name,
          price: addOn.price * 100,
          quantity: 1,
          amount: addOn.price * 100,
          tax: 'none',
          paymentMethod: 'full_prepayment',
          paymentObject: 'service'
        });
      });
    }

    // Generate receipt for fiscal compliance (54-FZ)
    const receipt = tbankPaymentService.generateReceipt({
      email: booking.customer.email,
      phone: booking.customer.phone,
      items: receiptItems,
      taxation: 'usn_income'
    });

    // Initialize payment with T-Bank
    const paymentResponse = await tbankPaymentService.initPayment({
      amount: amountInKopecks,
      orderId: orderId,
      description: description,
      customerEmail: booking.customer.email,
      customerPhone: booking.customer.phone,
      receipt: receipt,
      successUrl: successUrl,
      failUrl: failUrl,
      notificationUrl: notificationUrl,
      data: {
        BookingId: booking._id.toString(),
        CustomerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
        PackageId: booking.package.id
      }
    });

    if (!paymentResponse.success) {
      return res.status(500).json({
        success: false,
        message: paymentResponse.message || 'Failed to initialize payment',
        errorCode: paymentResponse.errorCode
      });
    }

    // Update booking with T-Bank payment information
    booking.payment.status = 'processing';
    booking.payment.paymentLink = paymentResponse.paymentUrl;
    booking.payment.tbank = {
      paymentId: paymentResponse.paymentId,
      orderId: orderId,
      terminalKey: process.env.TBANK_TERMINAL_KEY,
      paymentStatus: paymentResponse.status,
      amount: amountInKopecks,
      lastUpdated: new Date()
    };
    booking.updatedAt = new Date();

    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        paymentUrl: paymentResponse.paymentUrl,
        paymentId: paymentResponse.paymentId,
        orderId: orderId,
        amount: amountInKopecks,
        bookingNumber: booking.bookingNumber
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize payment',    });
  }
};

/**
 * Handle T-Bank payment webhook notification
 * @route POST /api/early-detection/payment/webhook
 * @access Public (but verified)
 */
exports.tbankPaymentWebhook = async (req, res) => {
  try {
    const notification = req.body;

    // Verify notification signature
    const isValid = tbankPaymentService.verifyNotification(notification);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    const {
      PaymentId,
      OrderId,
      Status,
      Amount,
      ErrorCode,
      Success,
      DATA
    } = notification;

    // Extract installment info if present
    const installmentInfo = DATA ? {
      plan: DATA.InstallmentPlan || DATA.CreditTerm,
      agreementNumber: DATA.AgreementNumber || DATA.CreditAgreementId,
      monthlyPayment: DATA.MonthlyPayment,
      provider: DATA.CreditProvider || 'tbank_credit'
    } : null;

    // Find booking by T-Bank PaymentId or OrderId
    let booking = await EarlyDetectionBooking.findOne({
      'payment.tbank.paymentId': PaymentId
    });

    if (!booking && OrderId) {
      // Try to find by OrderId (bookingNumber)
      booking = await EarlyDetectionBooking.findOne({
        bookingNumber: OrderId
      });
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Update payment status based on T-Bank status
    booking.payment.tbank.paymentStatus = Status;
    booking.payment.tbank.lastUpdated = new Date();
    booking.payment.tbank.errorCode = ErrorCode || null;

    switch (Status) {
      case 'CONFIRMED':
      case 'AUTHORIZED':
        // Payment successful
        booking.payment.status = 'paid';
        booking.payment.paidAt = new Date();
        booking.status = 'confirmed';

        // If installment info is present, update installment details
        if (installmentInfo && installmentInfo.plan && booking.payment.installment?.enabled) {
          booking.payment.installment.plan = installmentInfo.plan;
          booking.payment.installment.agreementNumber = installmentInfo.agreementNumber;
          booking.payment.installment.status = 'active';
          booking.payment.installment.provider = installmentInfo.provider;

          // Calculate payment schedule if we have the plan
          if (installmentInfo.plan) {
            const months = parseInt(installmentInfo.plan);
            const installmentDetails = require('../services/tbankPaymentService').calculateInstallmentPlan({
              totalAmount: booking.payment.tbank.amount,
              months: months,
              startDate: new Date()
            });

            booking.payment.installment.numberOfPayments = installmentDetails.numberOfPayments;
            booking.payment.installment.monthlyPayment = installmentDetails.monthlyPayment;
            booking.payment.installment.nextPaymentDate = installmentDetails.firstPaymentDate;
            booking.payment.installment.payments = installmentDetails.payments;
          }
        }
        break;

      case 'REJECTED':
      case 'REFUNDED':
        // Payment failed or refunded
        booking.payment.status = 'failed';
        break;

      case 'PARTIAL_REFUNDED':
        // Partial refund - keep as paid but log the event
        booking.payment.status = 'paid';
        break;

      case 'NEW':
      case 'FORM_SHOWED':
      case 'DEADLINE_EXPIRED':
      case 'CANCELED':
        // Payment cancelled or expired
        booking.payment.status = 'cancelled';
        break;

      case 'AUTHORIZING':
      case 'CONFIRMING':
        // Payment in progress
        booking.payment.status = 'processing';
        break;

      default:
    }

    booking.updatedAt = new Date();
    await booking.save();

    // Send response to T-Bank
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed',    });
  }
};

/**
 * Check payment status
 * @route GET /api/early-detection/payment/status/:bookingId
 * @access Public
 */
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await EarlyDetectionBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // If there's a T-Bank payment, fetch the latest status
    if (booking.payment.tbank?.paymentId) {
      try {
        const paymentState = await tbankPaymentService.getPaymentState(
          booking.payment.tbank.paymentId
        );

        // Update booking with latest status
        booking.payment.tbank.paymentStatus = paymentState.status;
        booking.payment.tbank.lastUpdated = new Date();

        // Update booking payment status based on T-Bank status
        if (paymentState.status === 'CONFIRMED' || paymentState.status === 'AUTHORIZED') {
          booking.payment.status = 'paid';
          booking.payment.paidAt = new Date();
          booking.status = 'confirmed';
        } else if (paymentState.status === 'REJECTED') {
          booking.payment.status = 'failed';
        }

        await booking.save();
      } catch (error) {
        // Continue with existing data
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        bookingNumber: booking.bookingNumber,
        paymentStatus: booking.payment.status,
        tbankStatus: booking.payment.tbank?.paymentStatus,
        paidAt: booking.payment.paidAt,
        amount: booking.totalAmount || booking.package?.price || 0,
        currency: booking.package?.currency || 'RUB'
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to check payment status',    });
  }
};

/**
 * Cancel T-Bank payment
 * @route POST /api/early-detection/payment/cancel
 * @access Public
 */
exports.cancelTBankPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    const booking = await EarlyDetectionBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (!booking.payment.tbank?.paymentId) {
      return res.status(400).json({
        success: false,
        message: 'No T-Bank payment found for this booking'
      });
    }

    if (booking.payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed payment'
      });
    }

    // Cancel payment in T-Bank
    const cancelResponse = await tbankPaymentService.cancelPayment(
      booking.payment.tbank.paymentId
    );

    if (!cancelResponse.success) {
      return res.status(500).json({
        success: false,
        message: cancelResponse.message || 'Failed to cancel payment',
        errorCode: cancelResponse.errorCode
      });
    }

    // Update booking
    booking.payment.status = 'cancelled';
    booking.payment.tbank.paymentStatus = cancelResponse.status;
    booking.payment.tbank.lastUpdated = new Date();
    booking.updatedAt = new Date();

    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Payment cancelled successfully',
      data: {
        bookingNumber: booking.bookingNumber,
        paymentStatus: booking.payment.status
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel payment',    });
  }
};
