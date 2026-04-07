require('dotenv').config();
const express = require("express");
const cors = require("cors");
const db = require("./db");

const widgetRoutes = require("./routes/widgetRoutes");
const formRoutes = require("./routes/formRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();

app.use(cors());

app.use("/webhooks/stripe", express.raw({ type: 'application/json' }), require("./routes/stripeWebhook"));

app.use(express.json());

// Razorpay fundamentally differs from Stripe; it uses strictly parsed JSON bodies for its crypto Hashing mechanism
app.use("/webhooks/razorpay", require("./routes/razorpayWebhook"));

// ---- GLOBAL JSON ENTERPRISE INTERCEPTOR ----
app.use((req, res, next) => {
  const originalJson = res.json;

  res.json = function (obj) {
    // Prevent recursive double wrapping if already perfectly standard
    if (obj && Object.prototype.hasOwnProperty.call(obj, 'success') && Object.prototype.hasOwnProperty.call(obj, 'data') && Object.prototype.hasOwnProperty.call(obj, 'error')) {
      return originalJson.call(this, obj);
    }

    const statusCode = res.statusCode;
    const isSuccess = statusCode >= 200 && statusCode < 300;

    // 1. Hard Failure Engine Map
    // If it's a 4xx/5xx code OR the controller returned { error: "..." } independently
    if (!isSuccess || (obj && obj.error !== undefined)) {
      return originalJson.call(this, {
        success: false,
        data: null,
        error: (obj && obj.error) ? obj.error : "An unexpected Node Infrastructure rejection occurred.",
        details: (obj && obj.details) ? obj.details : undefined
      });
    }

    // 2. Clean Data Payload Wrapper
    let cleanData = obj;
    let explicitMessage = null;

    if (typeof obj === 'object' && obj !== null) {
      cleanData = { ...obj };
      // Purge loose keys from older controllers before injecting into the Master Schema
      if (cleanData.success !== undefined) delete cleanData.success;
      if (cleanData.error !== undefined) delete cleanData.error;
      
      // Extract literal 'message' string logically up to the parent wrapper!
      if (cleanData.message !== undefined) {
          explicitMessage = cleanData.message;
          delete cleanData.message;
      }
    }

    // 3. Eject Formatted Object
    return originalJson.call(this, {
      success: true,
      message: explicitMessage,
      data: Object.keys(cleanData).length > 0 ? cleanData : null,
      error: null
    });
  };
  next();
});
// --------------------------------------------

app.use(express.static("public"));


app.use("/widget", widgetRoutes);
app.use("/form", formRoutes);
app.use("/conversation", conversationRoutes);
app.use("/conversations", conversationRoutes);
app.use("/messages", messageRoutes);

const aiMetricsRoutes = require("./routes/aiMetricsRoutes");
const convMetricsRoutes = require("./routes/conversationMetricsRoutes");
const formMetricsRoutes = require("./routes/formMetricsRoutes");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");

app.use("/ai/metrics", aiMetricsRoutes);
app.use("/metrics/conversations", convMetricsRoutes);
app.use("/metrics/forms", formMetricsRoutes);

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/notifications", notificationRoutes);
app.use("/subscription", subscriptionRoutes);

const utilityRoutes = require("./routes/utilityRoutes");
app.use("/utils", utilityRoutes);

app.use("/ai", aiRoutes);

app.listen(8000, () => {
  console.log("Server running on port 8000");
});
