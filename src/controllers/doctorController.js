const Doctor = require("../models/Doctor");
const User = require("../models/User");

const getAllDoctors = async (req, res) => {
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

    return res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Doctor database is unavailable right now.",
    });
  }
};

const getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate(
      "user",
      "name email role",
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Doctor database is unavailable right now.",
    });
  }
};

const createDoctor = async (req, res) => {
  try {
    const { user, name, specialization, email, phone, location, bio } =
      req.body;

    if (!user || !name || !specialization || !email || !phone || !location) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required doctor fields",
      });
    }

    const existingUser = await User.findById(user);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (existingUser.role !== "doctor") {
      return res.status(400).json({
        success: false,
        message:
          "Only users with doctor role can be linked to a doctor profile",
      });
    }

    const existingDoctor = await Doctor.findOne({ user: existingUser._id });
    if (existingDoctor) {
      return res.status(409).json({
        success: false,
        message: "This user already has a doctor profile",
      });
    }

    const newDoctor = await Doctor.create({
      user,
      name,
      specialization,
      email,
      phone,
      location,
      bio: bio || "",
    });

    const populatedDoctor = await newDoctor.populate("user", "name email role");

    return res.status(201).json({
      success: true,
      message: "Doctor profile created successfully",
      data: populatedDoctor,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
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

    return res.status(200).json({
      success: true,
      message: "Doctor profile updated successfully",
      data: updatedDoctor,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Doctor profile deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
