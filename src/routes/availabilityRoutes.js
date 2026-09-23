const express = require("express");
const { getAllAvailability } = require("../controllers/availabilityController");

const router = express.Router();

router.get("/", getAllAvailability);

module.exports = router;
