const express = require("express");
const {
  getAllAvailability,
  createAvailability,
  getAvailabilityByDoctor,
  updateAvailability,
  deleteAvailability,
} = require("../controllers/availabilityController");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const {
  doctorIdParamRules,
  availabilityIdParamRules,
  createAvailabilityValidationRules,
  updateAvailabilityValidationRules,
} = require("../services/validation/availabilityValidation");

const router = express.Router();

// Reads stay public -- patients need to browse slots to book.
router.get("/", getAllAvailability);
router.get("/doctor/:doctorId", doctorIdParamRules, getAvailabilityByDoctor);
// Writes are doctor self-service: the controller additionally verifies the
// slot's doctor profile belongs to the caller.
router.post("/", authenticate, requireRole("doctor"), createAvailabilityValidationRules, createAvailability);
router.put("/:id", authenticate, requireRole("doctor"), updateAvailabilityValidationRules, updateAvailability);
router.delete("/:id", authenticate, requireRole("doctor"), availabilityIdParamRules, deleteAvailability);

module.exports = router;
