const express = require("express");
const cors = require("cors");
const db = require("./db"); // initializes db connection

const widgetRoutes = require("./routes/widgetRoutes");
const formRoutes = require("./routes/formRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();

app.use(cors());

// STRIPE INJECTION: The Raw Webhook MUST be mapped physically before express.json() converts the Buffer bytes!
app.use("/webhooks/stripe", express.raw({ type: 'application/json' }), require("./routes/stripeWebhook"));

app.use(express.json());
app.use(express.static("public"));

// Mount routes
app.use("/widget", widgetRoutes);
app.use("/form", formRoutes);
app.use("/conversation", conversationRoutes);
app.use("/conversations", conversationRoutes); // For paths like /conversations/:widgetId
app.use("/messages", messageRoutes);

const aiMetricsRoutes = require("./routes/aiMetricsRoutes");
const convMetricsRoutes = require("./routes/conversationMetricsRoutes");
const formMetricsRoutes = require("./routes/formMetricsRoutes");

// Core Architecture Additions
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
