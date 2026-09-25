const express = require("express");
const Doctor = require("../models/Doctor");
const User = require("../models/User");

const router = express.Router();

const sendError = (res, statusCode, message) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

router.get("/", async (req, res) => {
  try {
    const { specialization, location, search } = req.query;

    const filters = {};

    if (specialization) {
      filters.specialization = { $regex: specialization, $options: "i" };
    }

    if (location) {
      filters.location = { $regex: location, $options: "i" };
    }

    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const doctors = await Doctor.find(filters)
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    sendError(res, 500, error.message);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate(
      "user",
      "name email role",
    );

    if (!doctor) {
      return sendError(res, 404, "Doctor not found");
    }

    res.json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    sendError(res, 500, error.message);
  }
});

router.post("/", async (req, res) => {
  try {
    const { user, name, specialization, email, phone, location, bio } =
      req.body;

    if (!user || !name || !specialization || !email || !phone || !location) {
      return sendError(res, 400, "Please provide all required doctor fields");
    }

    const existingUser = await User.findById(user);
    if (!existingUser) {
      return sendError(res, 404, "User not found");
    }

    if (existingUser.role !== "doctor") {
      return sendError(
        res,
        400,
        "Only users with doctor role can be linked to a doctor profile",
      );
    }

    const existingDoctor = await Doctor.findOne({ user: existingUser._id });
    if (existingDoctor) {
      return sendError(res, 409, "This user already has a doctor profile");
    }

    const doctor = await Doctor.create({
      user,
      name,
      specialization,
      email,
      phone,
      location,
      bio: bio || "",
    });

    const populatedDoctor = await doctor.populate("user", "name email role");

    res.status(201).json({
      success: true,
      message: "Doctor profile created successfully",
      data: populatedDoctor,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return sendError(res, 400, error.message);
    }

    sendError(res, 500, error.message);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return sendError(res, 404, "Doctor not found");
    }

    const allowedFields = [
      "name",
      "specialization",
      "email",
      "phone",
      "location",
      "bio",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        doctor[field] = req.body[field];
      }
    });

    await doctor.save();

    const updatedDoctor = await Doctor.findById(req.params.id).populate(
      "user",
      "name email role",
    );

    res.json({
      success: true,
      message: "Doctor profile updated successfully",
      data: updatedDoctor,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return sendError(res, 400, error.message);
    }

    sendError(res, 500, error.message);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);

    if (!doctor) {
      return sendError(res, 404, "Doctor not found");
    }

    res.json({
      success: true,
      message: "Doctor profile deleted successfully",
    });
  } catch (error) {
    sendError(res, 500, error.message);
  }
});

module.exports = router;
