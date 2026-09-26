const mongoose = require("mongoose");

const revokedTokenSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true,
  },

  // TTL index: MongoDB deletes the document once expiresAt is in the past, so revoked-token
  // records self-clean right after the token itself would have expired naturally anyway.
  expiresAt: {
    type: Date,
    required: true,
    expires: 0,
  },
});

const RevokedToken = mongoose.model("RevokedToken", revokedTokenSchema);

module.exports = RevokedToken;
