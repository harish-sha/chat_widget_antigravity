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
