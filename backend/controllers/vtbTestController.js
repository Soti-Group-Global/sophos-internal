const https = require("https");
const fs = require("fs");
const path = require("path");

const globalAny = global;
if (typeof globalAny.fetch !== "function") {
  globalAny.fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
}

process.env.NODE_EXTRA_CA_CERTS = path.join(
  __dirname,
  "../vtb/rootca_ssl_rsa2022.crt"
);

/**
 * Create an HTTPS agent with VTB SSL certificate chain.
 */
function createVtbAgent() {
  return new https.Agent({
    ca: [
      fs.readFileSync(path.join(__dirname, "../vtb/rootca_ssl_rsa2022.crt")),
      fs.readFileSync(path.join(__dirname, "../vtb/subca_ssl_rsa2022.crt")),
    ],
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  });
}

/**
 * Fetch an OAuth2 token from VTB.
 */
async function fetchVtbToken(tokenUrl, agent) {
  const { BANK_CLIENT_ID, BANK_CLIENT_SECRET } = process.env;

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: BANK_CLIENT_ID,
      client_secret: BANK_CLIENT_SECRET,
    }),
    agent,
  });

  const tokenData = await tokenRes.json();
  return { tokenRes, tokenData };
}

/**
 * GET /bank/test-connection
 * Test SSL chain and VTB credentials against sandbox.
 */
const testConnection = async (req, res) => {
  try {
    const { BANK_CLIENT_ID, BANK_CLIENT_SECRET } = process.env;
    if (!BANK_CLIENT_ID || !BANK_CLIENT_SECRET)
      return res.status(400).json({
        message: "Missing BANK_CLIENT_ID or BANK_CLIENT_SECRET",
      });

    const agent = createVtbAgent();

    // Use official VTB sandbox token URL per API docs section 4.16.1
    const TOKEN_URL =
      "https://epa-ift-sbp.vtb.ru:443/passport/oauth2/token";

    const { tokenRes, tokenData } = await fetchVtbToken(TOKEN_URL, agent);

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(500).json({
        message: "Failed to obtain access token",
        error: tokenData,
      });
    }

    return res.status(200).json({
      success: true,
      message: "SSL chain and VTB credentials OK",
      expires_in: tokenData.expires_in,
      token_preview: tokenData.access_token.slice(0, 40) + "...",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "VTB connection test failed",
      error: err.message,
    });
  }
};

/**
 * GET /bank/test-order
 * Create a sandbox test order via VTB e-commerce API.
 */
const testOrder = async (req, res) => {
  try {
    const { BANK_CLIENT_ID, BANK_CLIENT_SECRET, PAYMENT_RETURN_URL } =
      process.env;

    if (!BANK_CLIENT_ID || !BANK_CLIENT_SECRET || !PAYMENT_RETURN_URL) {
      return res
        .status(400)
        .json({ message: "Missing VTB config in environment variables" });
    }

    const agent = createVtbAgent();

    const TOKEN_URL =
      "https://epa-ift-sbp.vtb.ru:443/passport/oauth2/token";

    const { tokenRes, tokenData } = await fetchVtbToken(TOKEN_URL, agent);

    if (!tokenRes.ok || !tokenData.access_token) {
      return res
        .status(500)
        .json({ message: "Failed to obtain token", error: tokenData });
    }

    const accessToken = tokenData.access_token;

    const BASE_URL =
      "https://test3.api.vtb.ru:8443/openapi/smb/efcp/e-commerce/v1";
    const orderId = `TEST-${Date.now()}`;
    const expire = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const orderBody = {
      orderId,
      orderName: `Sandbox Test Order ${orderId}`,
      expire,
      amount: { value: 10.0, code: "RUB" },
      returnUrl: PAYMENT_RETURN_URL,
    };

    // Strip @ext.vtb.ru domain from client_id for X-IBM-Client-Id header
    const xIbmClientId = BANK_CLIENT_ID.split('@')[0].toLowerCase();

    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-IBM-Client-Id": xIbmClientId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(orderBody),
      agent,
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      return res.status(500).json({
        message: "Sandbox order creation failed",
        error: orderData,
      });
    }

    const payUrl =
      orderData?.object?.payUrl || orderData?.payUrl || orderData?.paymentUrl;

    if (!payUrl) {
      return res.status(500).json({
        message: "No payment URL received from VTB sandbox",
        response: orderData,
      });
    }

    return res.status(200).json({
      success: true,
      message: "VTB sandbox test order created successfully",
      orderId,
      payUrl,
      response: orderData,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "VTB sandbox test order failed",
      error: err.message,
    });
  }
};

/**
 * GET /bank/create-order
 * Create a live production order via VTB e-commerce API.
 */
const createOrder = async (req, res) => {
  try {
    const { BANK_CLIENT_ID, BANK_CLIENT_SECRET, PAYMENT_RETURN_URL } =
      process.env;

    if (!BANK_CLIENT_ID || !BANK_CLIENT_SECRET || !PAYMENT_RETURN_URL) {
      return res.status(400).json({
        message: "Missing required VTB config (client ID, secret, return URL)",
      });
    }

    const agent = createVtbAgent();

    const TOKEN_URL = "https://open.api.vtb.ru/passport/oauth2/token";
    const BASE_URL = "https://gw.api.vtb.ru/openapi/smb/efcp/e-commerce/v1";

    const { tokenRes, tokenData } = await fetchVtbToken(TOKEN_URL, agent);

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(500).json({
        message: "Failed to obtain VTB access token",
        error: tokenData,
      });
    }

    const accessToken = tokenData.access_token;

    const orderId = `LIVE-${Date.now()}`;
    const expire = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const orderBody = {
      orderId,
      orderName: `Live Order ${orderId}`,
      expire,
      amount: { value: 10.0, code: "RUB" },
      returnUrl: PAYMENT_RETURN_URL,
    };

    // Strip @ext.vtb.ru domain from client_id for X-IBM-Client-Id header
    const xIbmClientId = BANK_CLIENT_ID.split('@')[0].toLowerCase();

    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-IBM-Client-Id": xIbmClientId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(orderBody),
      agent,
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      return res.status(500).json({
        message: "VTB production order creation failed",
        error: orderData,
      });
    }

    const payUrl =
      orderData?.object?.payUrl || orderData?.payUrl || orderData?.paymentUrl;

    if (!payUrl) {
      return res.status(500).json({
        message: "No payment URL received from VTB",
        response: orderData,
      });
    }

    return res.status(200).json({
      success: true,
      message: "VTB live payment created successfully",
      orderId,
      payUrl,
      environment: "production",
      response: orderData,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "VTB live order creation failed",
      error: err.message,
    });
  }
};

/**
 * GET /bank/live-token
 * Obtain a live VTB access token (production endpoint).
 */
const getLiveToken = async (req, res) => {
  try {
    const { BANK_CLIENT_ID, BANK_CLIENT_SECRET } = process.env;
    if (!BANK_CLIENT_ID || !BANK_CLIENT_SECRET) {
      return res.status(400).json({
        message: "Missing BANK_CLIENT_ID or BANK_CLIENT_SECRET",
      });
    }

    const agent = createVtbAgent();

    const TOKEN_URL = "https://open.api.vtb.ru/passport/oauth2/token";

    const { tokenRes, tokenData } = await fetchVtbToken(TOKEN_URL, agent);

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(500).json({
        message: "Failed to get live token",
        error: tokenData,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Live VTB token received",
      expires_in: tokenData.expires_in,
      token_preview: tokenData.access_token.slice(0, 40) + "...",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "VTB live token failed",
      error: err.message,
    });
  }
};

/**
 * POST /bank/webhook
 * VTB Payment Webhook (callback) handler.
 * Per API docs section 4.14-4.15: Receives PaymentResponse and RefundResponse.
 */
const handleWebhook = async (req, res) => {
  try {
    const { type, object } = req.body;

    if (!type || !object) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const Application = require("../models/Application");

    if (type === "PAYMENT") {
      // PaymentResponse callback - per API docs section 4.15.1
      const { orderId, paymentId, paymentCode, amount, status, paymentData } = object;
      const statusValue = status?.value || object?.Status?.value;
      const statusDescription = status?.description || object?.Status?.description;

      if (orderId) {
        // Find application with this orderId in payments
        const application = await Application.findOne({
          "payments.invoiceNumber": orderId,
        });

        if (application) {
          const payment = application.payments.find(
            (p) => p.invoiceNumber === orderId
          );
          if (payment) {
            // Map VTB status to internal status per API docs section 4.10
            if (statusValue === "CONFIRMED" || statusValue === "RECONCILED") {
              payment.status = "paid";
              payment.paidAt = new Date();
            } else if (statusValue === "DECLINED") {
              payment.status = "cancelled";
            } else if (statusValue === "AUTHORIZED") {
              payment.status = "pending"; // Pre-auth hold
            } else if (statusValue === "REVERSED" || statusValue === "VOIDED") {
              payment.status = "cancelled";
            }
            payment.bankResponse = req.body;
            await application.save();
          }
        }
      }

      return res.status(200).json({ received: true });
    }

    if (type === "REFUND") {
      // RefundResponse callback - per API docs section 4.15.2
      const { orderId, refundId, amount, status } = object;
      const statusValue = status?.value || object?.Status?.value;

      if (orderId) {
        const application = await Application.findOne({
          "payments.invoiceNumber": orderId,
        });

        if (application) {
          const payment = application.payments.find(
            (p) => p.invoiceNumber === orderId
          );
          if (payment && statusValue === "CONFIRMED") {
            payment.status = "refunded";
            payment.bankResponse = req.body;
            await application.save();
          }
        }
      }

      return res.status(200).json({ received: true });
    }

    return res.status(200).json({ received: true, unhandledType: type });
  } catch (err) {
    // Always return 200 to prevent VTB from retrying
    return res.status(200).json({ received: true, error: err.message });
  }
};

/**
 * GET /bank/order-status/:orderId
 * Check VTB order status - GET v1/orders/{orderId}
 * Per API docs section 4.12.2.
 */
const getOrderStatus = async (req, res) => {
  try {
    const { BANK_CLIENT_ID, BANK_CLIENT_SECRET, VTB_MERCHANT_AUTH } = process.env;
    if (!BANK_CLIENT_ID || !BANK_CLIENT_SECRET) {
      return res.status(400).json({ message: "Missing VTB credentials" });
    }

    const agent = createVtbAgent();

    const isSandbox = process.env.IS_SANDBOX === 'true';
    const TOKEN_URL = isSandbox
      ? "https://epa-ift-sbp.vtb.ru:443/passport/oauth2/token"
      : "https://open.api.vtb.ru:443/passport/oauth2/token";
    const BASE_URL = isSandbox
      ? "https://test3.api.vtb.ru:8443/openapi/smb/efcp/e-commerce/v1"
      : "https://gw.api.vtb.ru/openapi/smb/efcp/e-commerce/v1";

    // Get access token
    const { tokenRes, tokenData } = await fetchVtbToken(TOKEN_URL, agent);

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(500).json({ message: "Failed to obtain token", error: tokenData });
    }

    const xIbmClientId = BANK_CLIENT_ID.split('@')[0].toLowerCase();
    const headers = {
      Authorization: `Bearer ${tokenData.access_token}`,
      "X-IBM-Client-Id": xIbmClientId,
      "Content-Type": "application/json",
    };
    if (VTB_MERCHANT_AUTH) {
      headers["Merchant-Authorization"] = VTB_MERCHANT_AUTH;
    }

    // GET v1/orders/{orderId} per API docs section 4.12.2
    const orderRes = await fetch(
      `${BASE_URL}/orders/${encodeURIComponent(req.params.orderId)}`,
      { method: "GET", headers, agent }
    );

    const orderData = await orderRes.json();
    return res.status(orderRes.status).json(orderData);
  } catch (err) {
    return res.status(500).json({ message: "Failed to check order status", error: err.message });
  }
};

module.exports = {
  testConnection,
  testOrder,
  createOrder,
  getLiveToken,
  handleWebhook,
  getOrderStatus,
};
