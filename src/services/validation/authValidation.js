const { body } = require("express-validator");

const registerValidationRules = [
  body("name").isString().trim().notEmpty().withMessage("name is required"),
  body("email").isString().withMessage("a valid email is required").trim().isEmail().withMessage("a valid email is required"),
  body("password")
    .isString()
    .withMessage("password must be between 8 and 72 characters")
    .isLength({ min: 8, max: 72 })
    .withMessage("password must be between 8 and 72 characters"),
  body("role")
    .isIn(["patient", "doctor"])
    .withMessage("role must be either 'patient' or 'doctor'"),
];

const loginValidationRules = [
  body("email").isString().withMessage("a valid email is required").trim().isEmail().withMessage("a valid email is required"),
  body("password").isString().notEmpty().withMessage("password is required"),
];

module.exports = { registerValidationRules, loginValidationRules };
