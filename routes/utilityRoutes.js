const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const utilityController = require("../controllers/utilityController");
const { authMiddleware } = require("../middleware/authMiddleware");

// Custom Disk Allocation logic prioritizing internal Server storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Bypasses local /tmp architectures and targets explicit Express static mount
    cb(null, "public/uploads"); 
  },
  filename: (req, file, cb) => {
    // Massive randomizer ensuring 100% block override protection
    const uniqueSuffix = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueSuffix);
  }
});
const upload = multer({ storage: storage });

// Open permission gate allowing both Dashboard Admins and Chat Widget Users to invoke Image saving structures!
router.post("/upload", upload.single('file'), utilityController.handleUpload);

module.exports = router;
