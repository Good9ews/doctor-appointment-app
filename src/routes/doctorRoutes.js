const express = require("express");
const {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} = require("../controllers/doctorController");
const {
  createDoctorValidationRules,
  updateDoctorValidationRules,
  doctorIdValidationRules,
} = require("../services/validation/doctorValidation");

const router = express.Router();

router.get("/", getAllDoctors);
router.get("/:id", doctorIdValidationRules, getDoctorById);
router.post("/", createDoctorValidationRules, createDoctor);
router.put("/:id", updateDoctorValidationRules, updateDoctor);
router.delete("/:id", doctorIdValidationRules, deleteDoctor);

module.exports = router;
