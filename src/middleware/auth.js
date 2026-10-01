const mongoose = require("mongoose");
const User = require("../models/User");
const { verifyToken } = require("../services/token/jwt");
const { isTokenRevoked } = require("../services/token/revocation");

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

  // Every token this service issues has this exact shape (see signToken): a non-empty
  // string jti, a numeric exp, and a sub that's a valid ObjectId. Anything else is not one
  // of ours -- reject it here, before it reaches revocation/DB lookups. In particular, a
  // missing/malformed jti must never reach isTokenRevoked/revokeToken: Mongoose would cast
  // it to {jti: null} and that single row would match -- and revoke -- every other jti-less
  // token too, not just this one.
  const hasValidShape =
    typeof payload.jti === "string" &&
    payload.jti.length > 0 &&
    typeof payload.exp === "number" &&
    typeof payload.sub === "string" &&
    mongoose.Types.ObjectId.isValid(payload.sub);

  if (!hasValidShape) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  let user;
  try {
    const revoked = await isTokenRevoked(payload.jti);
    if (revoked) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    user = await User.findById(payload.sub);
  } catch (error) {
    // The token's shape was already validated above, so an error here means the revocation
    // check or user lookup itself failed (e.g. the database is briefly unreachable) -- not
    // that the credentials are bad. Reporting that as 401 would make clients discard a
    // perfectly valid token and force every user to log back in over a transient blip.
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable, please try again",
    });
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "User no longer exists",
    });
  }

  req.user = user;
  // Carries the claims from the token at the moment it was issued -- do not use
  // req.tokenPayload.role (or any other claim) for authorization decisions, since it can be
  // stale for up to the token's full lifetime after a role change. Use req.user for that.
  req.tokenPayload = payload;
  next();
};

const authorizeRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action",
      });
    }
    return next();
  };

module.exports = { authenticate, authorizeRole };
