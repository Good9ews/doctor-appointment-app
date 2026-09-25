const mongoose = require("mongoose");
const { hashPassword } = require("../services/password/hash");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["patient", "doctor"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function hashPasswordBeforeSave() {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await hashPassword(this.password);
});

const User = mongoose.model("User", userSchema);

module.exports = User;
