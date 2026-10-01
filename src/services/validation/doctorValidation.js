const { body, param, validationResult } = require("express-validator");

const doctorIdParamRule = [
  param("id").isMongoId().withMessage("invalid doctor id"),
];

const returnValidationError = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }
  return next();
};

const requiredString = (field, max) =>
  body(field)
    .isString()
    .withMessage(`${field} must be a string`)
    .trim()
    .notEmpty()
    .withMessage(`${field} is required`)
    .isLength({ max })
    .withMessage(`${field} must be at most ${max} characters`);

const optionalString = (field, max) =>
  body(field)
    .optional()
    .isString()
    .withMessage(`${field} must be a string`)
    .trim()
    .notEmpty()
    .withMessage(`${field} must not be empty`)
    .isLength({ max })
    .withMessage(`${field} must be at most ${max} characters`);

const emailRule = (optional) => {
  const chain = optional ? body("email").optional() : body("email");
  return chain
    .isString()
    .withMessage("a valid email is required")
    .trim()
    .isEmail()
    .withMessage("a valid email is required")
    .isLength({ max: 254 })
    .withMessage("a valid email is required");
};

const phoneRule = (optional) => {
  const chain = optional ? body("phone").optional() : body("phone");
  return chain
    .isString()
    .withMessage("phone must be a string")
    .trim()
    .notEmpty()
    .withMessage(optional ? "phone must not be empty" : "phone is required")
    .isLength({ min: 7, max: 30 })
    .withMessage("phone must be between 7 and 30 characters");
};

const createDoctorValidationRules = [
  body("user").isMongoId().withMessage("user must be a valid user id"),
  requiredString("name", 120),
  requiredString("specialization", 120),
  emailRule(false),
  phoneRule(false),
  requiredString("location", 180),
  body("bio")
    .optional()
    .isString()
    .withMessage("bio must be a string")
    .trim()
    .isLength({ max: 2000 })
    .withMessage("bio must be at most 2000 characters"),
  returnValidationError,
];

const updateDoctorValidationRules = [
  ...doctorIdParamRule,
  optionalString("name", 120),
  optionalString("specialization", 120),
  emailRule(true),
  phoneRule(true),
  optionalString("location", 180),
  body("bio")
    .optional()
    .isString()
    .withMessage("bio must be a string")
    .trim()
    .isLength({ max: 2000 })
    .withMessage("bio must be at most 2000 characters"),
  returnValidationError,
];

const doctorIdValidationRules = [...doctorIdParamRule, returnValidationError];

module.exports = {
  createDoctorValidationRules,
  updateDoctorValidationRules,
  doctorIdValidationRules,
};
