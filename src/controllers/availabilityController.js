const Availability = require("../models/Availability");

const getAllAvailability = async (req, res) => {
  try {
    const availability = await Availability.find().sort({
      date: 1,
      startTime: 1,
    });

    return res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    console.error("Failed to fetch availability:", error.message);

    return res.status(500).json({
      success: false,
      message: "Availability database is unavailable right now.",
    });
  }
};

module.exports = {
  getAllAvailability,
};
