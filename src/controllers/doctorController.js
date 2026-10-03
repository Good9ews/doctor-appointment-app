const { validationResult } = require("express-validator");
const Doctor = require("../models/Doctor");
const User = require("../models/User");

const DOCTOR_IMAGES = [
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1638202993928-7d113b8a5e0a?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1618498082410-b4aa22193b38?auto=format&fit=crop&w=600&q=80",
];
const validationErrorResponse = (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });

    return true;
  }

  return false;
};

const DOCTOR_DB_UNAVAILABLE =
  "Doctor database is unavailable right now.";

const getAllDoctors = async (req, res) => {
  try {
    const { specialization, location, search } = req.query;

    const filters = {};

    if (specialization) {
      filters.specialization = {
        $regex: specialization,
        $options: "i",
      };
    }

    if (location) {
      filters.location = {
        $regex: location,
        $options: "i",
      };
    }

    if (search) {
      filters.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          specialization: {
            $regex: search,
            $options: "i",
          },
        },
        {
          location: {
            $regex: search,
            $options: "i",
          },
        },
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
      message: DOCTOR_DB_UNAVAILABLE,
    });
  }
};

const getDoctorById = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

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
      message: DOCTOR_DB_UNAVAILABLE,
    });
  }
};

const createDoctor = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const userId = req.user._id;

    const {
      name,
      specialization,
      email,
      phone,
      location,
      bio,
    } = req.body;

    if (
      !name ||
      !specialization ||
      !email ||
      !phone ||
      !location
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required doctor fields",
      });
    }

    const existingUser = await User.findById(userId);

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

    const existingDoctor = await Doctor.findOne({
      user: userId,
    });

    if (existingDoctor) {
      return res.status(409).json({
        success: false,
        message: "This user already has a doctor profile",
      });
    }

    // Assign a local image automatically to the new doctor.
    const doctorCount = await Doctor.countDocuments();

    const image =
      DOCTOR_IMAGES[doctorCount % DOCTOR_IMAGES.length];

    const newDoctor = await Doctor.create({
      user: userId,
      name,
      specialization,
      email,
      phone,
      location,
      bio: bio || "",
      image,
    });

    const populatedDoctor = await newDoctor.populate(
      "user",
      "name email role",
    );

    return res.status(201).json({
      success: true,
      message: "Doctor profile created successfully",
      data: populatedDoctor,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Doctor data is invalid",
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
    });
  }
};

const updateDoctor = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    if (
      doctor.user.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only update your own doctor profile",
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

    const updatedDoctor = await Doctor.findById(
      req.params.id,
    ).populate("user", "name email role");

    return res.status(200).json({
      success: true,
      message: "Doctor profile updated successfully",
      data: updatedDoctor,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Doctor data is invalid",
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
    });
  }
};

const deleteDoctor = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    if (
      doctor.user.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only delete your own doctor profile",
      });
    }

    await doctor.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Doctor profile deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
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