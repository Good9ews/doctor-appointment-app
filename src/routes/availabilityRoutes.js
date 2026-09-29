const express = require("express");
const {
  getAllAvailability,
  createAvailability,
  getAvailabilityByDoctor,
} = require("../controllers/availabilityController");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const {
  doctorIdParamRules,
  createAvailabilityValidationRules,
} = require("../services/validation/availabilityValidation");

const router = express.Router();

// Reads stay public -- patients need to browse slots to book.
router.get("/", getAllAvailability);
router.get("/doctor/:doctorId", doctorIdParamRules, getAvailabilityByDoctor);
// Writes are doctor self-service: the controller additionally verifies the
// slot's doctor profile belongs to the caller.
router.post("/", authenticate, requireRole("doctor"), createAvailabilityValidationRules, createAvailability);

module.exports = router;
