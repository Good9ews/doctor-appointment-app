const Doctor = require("../models/Doctor");

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

const authorizeDoctorSelf = (req, res, next) => {
  if (
    String(req.body.user).toLowerCase() !== String(req.user._id).toLowerCase()
  ) {
    return sendError(res, 403, "You can only create your own doctor profile");
  }
  return next();
};

const authorizeDoctorOwner = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select("user");
    if (!doctor) {
      return sendError(res, 404, "Doctor not found");
    }
    if (
      String(doctor.user).toLowerCase() !== String(req.user._id).toLowerCase()
    ) {
      return sendError(res, 403, "You can only manage your own doctor profile");
    }
    return next();
  } catch (error) {
    return sendError(res, 500, "An unexpected error occurred");
  }
};

module.exports = { authorizeDoctorSelf, authorizeDoctorOwner };
