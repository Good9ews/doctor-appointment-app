const RevokedToken = require("../../models/RevokedToken");

const isValidJti = (jti) => typeof jti === "string" && jti.length > 0;

const revokeToken = async (jti, expiresAt) => {
  if (!isValidJti(jti)) {
    throw new Error("revokeToken requires a non-empty string jti");
  }
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
    throw new Error("revokeToken requires a valid expiresAt Date");
  }

  try {
    await RevokedToken.updateOne({ jti }, { $set: { expiresAt } }, { upsert: true, runValidators: true });
  } catch (error) {
    // A concurrent upsert against the same jti's unique index can raise E11000 (two
    // simultaneous logout calls for the same token racing each other). That means the token
    // is already revoked -- which is exactly what this call was trying to achieve -- so
    // treat it as success rather than surfacing a 500 for an outcome the caller wanted.
    if (error.code !== 11000) {
      throw error;
    }
  }
};

const isTokenRevoked = async (jti) => {
  // No valid jti means we can't tell whether this specific token was revoked -- and it must
  // never be treated as a wildcard match against every other jti-less/malformed token, so
  // fail closed (treat as revoked) rather than querying Mongo with an unsafe value.
  if (!isValidJti(jti)) {
    return true;
  }

  const revoked = await RevokedToken.exists({ jti });
  return Boolean(revoked);
};

module.exports = { revokeToken, isTokenRevoked };
