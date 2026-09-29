const express = require("express");
const {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} = require("../controllers/doctorController");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const {
  createDoctorValidationRules,
  updateDoctorValidationRules,
  doctorIdValidationRules,
} = require("../services/validation/doctorValidation");

const router = express.Router();

// Reads stay public -- the doctor directory must be browsable for booking.
router.get("/", getAllDoctors);
router.get("/:id", doctorIdValidationRules, getDoctorById);
// Writes are doctor self-service: the controller additionally verifies the
// profile belongs to the caller.
router.post("/", authenticate, requireRole("doctor"), createDoctorValidationRules, createDoctor);
router.put("/:id", authenticate, requireRole("doctor"), updateDoctorValidationRules, updateDoctor);
router.delete("/:id", authenticate, requireRole("doctor"), doctorIdValidationRules, deleteDoctor);

module.exports = router;
