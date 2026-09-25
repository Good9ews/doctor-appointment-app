const jwt = require("jsonwebtoken");

const ALGORITHM = "HS256";

const signToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  });
};

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGORITHM] });
};

module.exports = { signToken, verifyToken };
