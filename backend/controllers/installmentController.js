const EarlyDetectionBooking = require('../models/EarlyDetectionBooking');
const tbankPaymentService = require('../services/tbankPaymentService');

/**
 * Installment Payment Controller for Early Detection Bookings
 */

/**
 * Initialize installment payment for a booking
 * Enables installment option - T-Bank will decide eligibility and available plans
 * @route POST /api/early-detection/payment/installment/init
 * @access Public
 */
exports.initInstallmentPayment = async (req, res) => {
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

    // Prepare payment data - use totalAmount (package + add-ons) if available
    const totalPrice = booking.totalAmount || booking.package?.price || 0;
    const amountInKopecks = totalPrice * 100;
    const orderId = booking.bookingNumber || `ED-${booking._id}`;

    // Build description based on what was selected
    const instHasAddOns = booking.addOns && booking.addOns.length > 0;
    let description;
    if (instHasAddOns) {
      description = `Оплата за пакет "${booking.package.name}" + ${booking.addOns.length} доп. опций (возможна рассрочка)`;
    } else {
      description = `Оплата за пакет "${booking.package.name}" (возможна рассрочка)`;
    }

    // Prepare URLs
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const successUrl = `${baseUrl}/early-detection/payment-success?bookingId=${booking._id}&installment=true`;
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
    if (instHasAddOns) {
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

    // Generate receipt
    const receipt = tbankPaymentService.generateReceipt({
      email: booking.customer.email,
      phone: booking.customer.phone,
      items: receiptItems,
      taxation: 'usn_income'
    });

    // Initialize payment with installment option enabled
    // T-Bank will show installment plans to customer if they're eligible
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
      installment: {
        enabled: true // T-Bank decides available plans based on their criteria
      },
      data: {
        BookingId: booking._id.toString(),
        CustomerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
        PackageId: booking.package.id,
        PaymentType: 'installment_enabled'
      }
    });

    if (!paymentResponse.success) {
      return res.status(500).json({
        success: false,
        message: paymentResponse.message || 'Failed to initialize installment payment',
        errorCode: paymentResponse.errorCode
      });
    }

    // Update booking - mark as installment enabled
    // Actual installment details will be updated via webhook after customer selects plan
    booking.payment.paymentMethod = booking.payment.paymentMethod || 'tbank';
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
    booking.payment.installment = {
      enabled: true,
      plan: null, // Will be set by T-Bank via webhook
      totalAmount: amountInKopecks,
      monthlyPayment: null,
      numberOfPayments: null,
      paidPayments: 0,
      nextPaymentDate: null,
      status: null,
      provider: 'tbank_credit',
      payments: []
    };
    booking.updatedAt = new Date();

    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Payment initialized with installment option. T-Bank will show available plans to customer.',
      data: {
        paymentUrl: paymentResponse.paymentUrl,
        paymentId: paymentResponse.paymentId,
        orderId: orderId,
        totalAmount: booking.totalAmount || booking.package.price,
        currency: booking.package.currency || 'RUB',
        bookingNumber: booking.bookingNumber,
        note: 'Customer will select installment plan on T-Bank payment page if eligible'
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize installment payment',    });
  }
};

/**
 * Get installment payment details
 * @route GET /api/early-detection/payment/installment/:bookingId
 * @access Public
 */
exports.getInstallmentDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await EarlyDetectionBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (!booking.payment.installment || !booking.payment.installment.enabled) {
      return res.status(400).json({
        success: false,
        message: 'This booking is not on an installment plan'
      });
    }

    const installment = booking.payment.installment;

    // Calculate remaining payments
    const remainingPayments = installment.payments.filter(p => p.status === 'pending');
    const overduePayments = installment.payments.filter(p => {
      return p.status === 'pending' && new Date(p.dueDate) < new Date();
    });

    return res.status(200).json({
      success: true,
      data: {
        bookingNumber: booking.bookingNumber,
        installmentStatus: installment.status,
        totalAmount: installment.totalAmount / 100, // Convert to rubles
        monthlyPayment: installment.monthlyPayment ? installment.monthlyPayment / 100 : null,
        plan: installment.plan,
        numberOfPayments: installment.numberOfPayments,
        paidPayments: installment.paidPayments,
        remainingPayments: remainingPayments.length,
        overduePayments: overduePayments.length,
        nextPaymentDate: installment.nextPaymentDate,
        agreementNumber: installment.agreementNumber,
        payments: installment.payments.map(p => ({
          paymentNumber: p.paymentNumber,
          amount: p.amount / 100,
          dueDate: p.dueDate,
          paidDate: p.paidDate,
          status: p.status,
          isOverdue: p.status === 'pending' && new Date(p.dueDate) < new Date()
        }))
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get installment details',    });
  }
};

/**
 * Update installment payment status (after webhook)
 * @route POST /api/early-detection/payment/installment/update
 * @access Private (internal use)
 */
exports.updateInstallmentPayment = async (req, res) => {
  try {
    const { bookingId, paymentNumber, status, paidDate, paymentId } = req.body;

    if (!bookingId || !paymentNumber) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and payment number are required'
      });
    }

    const booking = await EarlyDetectionBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (!booking.payment.installment || !booking.payment.installment.enabled) {
      return res.status(400).json({
        success: false,
        message: 'This booking is not on an installment plan'
      });
    }

    // Find and update the specific payment
    const paymentIndex = booking.payment.installment.payments.findIndex(
      p => p.paymentNumber === paymentNumber
    );

    if (paymentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Update payment status
    booking.payment.installment.payments[paymentIndex].status = status || 'paid';
    if (paidDate) {
      booking.payment.installment.payments[paymentIndex].paidDate = paidDate;
    }
    if (paymentId) {
      booking.payment.installment.payments[paymentIndex].paymentId = paymentId;
    }

    // Update installment counters
    const paidCount = booking.payment.installment.payments.filter(
      p => p.status === 'paid'
    ).length;
    booking.payment.installment.paidPayments = paidCount;

    // Update next payment date
    const nextPending = booking.payment.installment.payments.find(
      p => p.status === 'pending'
    );
    booking.payment.installment.nextPaymentDate = nextPending ? nextPending.dueDate : null;

    // Check if all payments are completed
    if (paidCount === booking.payment.installment.numberOfPayments) {
      booking.payment.installment.status = 'completed';
      booking.payment.status = 'paid';
      booking.payment.paidAt = new Date();
      booking.status = 'confirmed';
    } else {
      booking.payment.status = 'partially_paid';
    }

    // Check for overdue payments
    const hasOverdue = booking.payment.installment.payments.some(
      p => p.status === 'pending' && new Date(p.dueDate) < new Date()
    );
    if (hasOverdue) {
      booking.payment.installment.status = 'overdue';
    }

    booking.updatedAt = new Date();
    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Installment payment updated successfully',
      data: {
        paidPayments: booking.payment.installment.paidPayments,
        remainingPayments: booking.payment.installment.numberOfPayments - paidCount,
        installmentStatus: booking.payment.installment.status,
        paymentStatus: booking.payment.status
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update installment payment',    });
  }
};

/**
 * Cancel installment plan
 * @route POST /api/early-detection/payment/installment/cancel
 * @access Public
 */
exports.cancelInstallmentPlan = async (req, res) => {
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

    if (!booking.payment.installment || !booking.payment.installment.enabled) {
      return res.status(400).json({
        success: false,
        message: 'This booking is not on an installment plan'
      });
    }

    // Cancel all pending payments
    booking.payment.installment.payments.forEach(payment => {
      if (payment.status === 'pending') {
        payment.status = 'cancelled';
      }
    });

    booking.payment.installment.status = 'cancelled';
    booking.payment.status = 'cancelled';
    booking.updatedAt = new Date();

    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Installment plan cancelled successfully',
      data: {
        bookingNumber: booking.bookingNumber,
        paidPayments: booking.payment.installment.paidPayments,
        cancelledPayments: booking.payment.installment.payments.filter(
          p => p.status === 'cancelled'
        ).length
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel installment plan',    });
  }
};
