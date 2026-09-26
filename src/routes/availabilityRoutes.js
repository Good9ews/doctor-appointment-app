const express = require("express");
const {
  getAllAvailability,
  createAvailability,
  getAvailabilityByDoctor,
} = require("../controllers/availabilityController");

const router = express.Router();

router.get("/", getAllAvailability);
router.get("/doctor/:doctorId", getAvailabilityByDoctor);
router.post("/", createAvailability);

module.exports = router;
