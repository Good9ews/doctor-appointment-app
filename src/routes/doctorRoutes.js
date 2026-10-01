const express = require("express");
const {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} = require("../controllers/doctorController");
const { authenticate, authorizeRole } = require("../middleware/auth");
const {
  authorizeDoctorOwner,
  authorizeDoctorSelf,
} = require("../middleware/doctorAuthorization");
const {
  validateCreateDoctor,
  validateDoctorId,
  validateUpdateDoctor,
} = require("../services/validation/doctorValidation");

const router = express.Router();

router.get("/", getAllDoctors);
router.get("/:id", validateDoctorId, getDoctorById);
router.post(
  "/",
  authenticate,
  authorizeRole("doctor"),
  validateCreateDoctor,
  authorizeDoctorSelf,
  createDoctor,
);
router.put(
  "/:id",
  authenticate,
  authorizeRole("doctor"),
  validateDoctorId,
  validateUpdateDoctor,
  authorizeDoctorOwner,
  updateDoctor,
);
router.delete(
  "/:id",
  authenticate,
  authorizeRole("doctor"),
  validateDoctorId,
  authorizeDoctorOwner,
  deleteDoctor,
);

module.exports = router;
