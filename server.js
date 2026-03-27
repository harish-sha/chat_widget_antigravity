const express = require("express");
const cors = require("cors");
const db = require("./db"); // initializes db connection

const widgetRoutes = require("./routes/widgetRoutes");
const formRoutes = require("./routes/formRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Mount routes
app.use("/widget", widgetRoutes);
app.use("/form", formRoutes);
app.use("/conversation", conversationRoutes);
app.use("/conversations", conversationRoutes); // For paths like /conversations/:widgetId
app.use("/messages", messageRoutes);

app.listen(8000, () => {
  console.log("Server running on port 8000");
});
