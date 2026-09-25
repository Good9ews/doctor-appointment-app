const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Doctor = require("../models/Doctor");

/**
 * AUTHENTICATION
 * Verifies the JWT and attaches the logged-in user to req.user
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    const header = req.headers.authorization;

    if (header && header.startsWith("Bearer")) {
      token = header.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      const message =
        error.name === "TokenExpiredError"
          ? "Session expired, please log in again"
          : "Not authorized, invalid token";
      return res.status(401).json({ success: false, message });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "The user belonging to this token no longer exists",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: "Authentication error" });
  }
};

/**
 * AUTHORIZATION (role-based)
 * Usage: authorize("doctor"), authorize("patient", "doctor")
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not permitted to access this resource`,
      });
    }
    next();
  };
};

/**
 * AUTHORIZATION (resource ownership)
 * For routes like /appointments/:id — makes sure a patient can only
 * touch their own appointment, and a doctor can only touch appointments
 * tied to their own Doctor profile.
 * Pass the Mongoose model and the field on it that stores the owner ref.
 */
exports.checkOwnership = (Model, patientField = "patient", doctorField = "doctor") => {
  return async (req, res, next) => {
    try {
      const resource = await Model.findById(req.params.id);
      if (!resource) {
        return res.status(404).json({ success: false, message: "Resource not found" });
      }

      if (req.user.role === "patient") {
        if (resource[patientField].toString() !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to access this resource",
          });
        }
      }

      if (req.user.role === "doctor") {
        const doctorProfile = await Doctor.findOne({ user: req.user._id });
        if (
          !doctorProfile ||
          resource[doctorField].toString() !== doctorProfile._id.toString()
        ) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to access this resource",
          });
        }
      }

      req.resource = resource; // pass it along so the controller doesn't refetch
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: "Authorization error" });
    }
  };
};