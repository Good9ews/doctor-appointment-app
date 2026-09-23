const User = require("../models/User");
const { verifyToken } = require("../services/token/jwt");

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token missing",
    });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  let user;
  try {
    user = await User.findById(payload.sub);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "User no longer exists",
    });
  }

  req.user = user;
  next();
};

module.exports = { authenticate };
