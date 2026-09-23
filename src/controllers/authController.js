const { validationResult } = require("express-validator");
const User = require("../models/User");
const { comparePassword } = require("../services/password/hash");
const { signToken } = require("../services/token/jwt");

// A fixed, valid bcrypt hash with no known plaintext. Compared against on a login for an
// email that doesn't exist, so the response takes roughly the same time either way and an
// attacker can't use response latency to enumerate registered emails.
const DUMMY_HASH = "$2b$12$WqOnHqNnIJwX.DFtjocst.iL5BgyHkwHhBF8x2mKGcok6yc.R1PSW";

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }

  const { name, email, password, role } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists",
    });
  }

  let user;
  try {
    user = await User.create({ name, email, password, role });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
    throw error;
  }

  const token = signToken({ sub: user._id.toString(), role: user.role });

  return res.status(201).json({
    success: true,
    token,
    user: formatUser(user),
  });
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }

  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  const isMatch = await comparePassword(password, user ? user.password : DUMMY_HASH);

  if (!user || !isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const token = signToken({ sub: user._id.toString(), role: user.role });

  return res.status(200).json({
    success: true,
    token,
    user: formatUser(user),
  });
};

const me = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: formatUser(req.user),
  });
};

module.exports = { register, login, me };
