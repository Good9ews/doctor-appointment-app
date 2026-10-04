const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const User = require("../src/models/User");
const Doctor = require("../src/models/Doctor");
const Availability = require("../src/models/Availability");
const Appointment = require("../src/models/Appointment");
const { signToken } = require("../src/services/token/jwt");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { serverSelectionTimeoutMS: 10000 });
}, 60000);

afterEach(async () => {
  await User.deleteMany({});
  await Doctor.deleteMany({});
  await Availability.deleteMany({});
  await Appointment.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

let emailCounter = 0;
const uniqueEmail = () => `user-${Date.now()}-${emailCounter++}@example.com`;

const makeUser = (role = "patient") =>
  User.create({
    name: role === "patient" ? "Jane Patient" : "Greg House",
    email: uniqueEmail(),
    password: "correcthorsebattery",
    role,
  });

const tokenFor = (user) => signToken({ sub: user._id.toString(), role: user.role });
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const makeDoctorProfile = async (user) =>
  Doctor.create({
    user: user._id,
    name: "Greg House",
    specialization: "Diagnostics",
    email: uniqueEmail(),
    phone: "+15551234567",
    location: "Princeton",
    image: "https://example.com/house.jpg",
  });

const futureDate = (daysAhead = 7) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(10, 0, 0, 0);
  return d;
};

const makeSlot = (doctorId, overrides = {}) =>
  Availability.create({
    doctor: doctorId,
    date: futureDate(),
    startTime: "09:00",
    endTime: "12:00",
    ...overrides,
  });

const bookBody = (doctorId, slotId, overrides = {}) => ({
  doctorId: doctorId.toString(),
  availabilityId: slotId.toString(),
  appointmentDate: futureDate().toISOString(),
  startTime: "09:30",
  endTime: "10:00",
  ...overrides,
});

const setupBooking = async () => {
  const patient = await makeUser("patient");
  const doctorUser = await makeUser("doctor");
  const profile = await makeDoctorProfile(doctorUser);
  const slot = await makeSlot(profile._id);
  return {
    patient,
    patientToken: tokenFor(patient),
    doctorUser,
    doctorToken: tokenFor(doctorUser),
    profile,
    slot,
  };
};

describe("POST /api/appointments", () => {
  test("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post("/api/appointments").send({});

    expect(res.status).toBe(401);
  });

  test("rejects non-patients with 403", async () => {
    const { doctorToken, profile, slot } = await setupBooking();
    const res = await request(app)
      .post("/api/appointments")
      .set(auth(doctorToken))
      .send(bookBody(profile._id, slot._id));

    expect(res.status).toBe(403);
  });

  test("books an appointment and marks the slot booked (happy path)", async () => {
    const { patientToken, profile, slot } = await setupBooking();
    const res = await request(app)
      .post("/api/appointments")
      .set(auth(patientToken))
      .send(bookBody(profile._id, slot._id));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("pending");

    const updated = await Availability.findById(slot._id);
    expect(updated.isBooked).toBe(true);
  });

  test("rejects a second booking of the same slot with 409", async () => {
    const { patientToken, profile, slot } = await setupBooking();
    const other = await makeUser("patient");

    await request(app)
      .post("/api/appointments")
      .set(auth(patientToken))
      .send(bookBody(profile._id, slot._id));

    const res = await request(app)
      .post("/api/appointments")
      .set(auth(tokenFor(other)))
      .send(bookBody(profile._id, slot._id));

    expect(res.status).toBe(409);
  });

  test("concurrent bookings of the same slot yield exactly one success", async () => {
    const { patientToken, profile, slot } = await setupBooking();
    const other = await makeUser("patient");
    const body = bookBody(profile._id, slot._id);

    const [first, second] = await Promise.all([
      request(app).post("/api/appointments").set(auth(patientToken)).send(body),
      request(app).post("/api/appointments").set(auth(tokenFor(other))).send(body),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await Appointment.countDocuments({})).toBe(1);
  });

  test("rejects a slot belonging to another doctor with 400", async () => {
    const { patientToken, profile } = await setupBooking();
    const otherDoctorUser = await makeUser("doctor");
    const otherProfile = await makeDoctorProfile(otherDoctorUser);
    const otherSlot = await makeSlot(otherProfile._id);

    const res = await request(app)
      .post("/api/appointments")
      .set(auth(patientToken))
      .send(bookBody(profile._id, otherSlot._id));

    expect(res.status).toBe(400);
  });

  test("rejects times outside the availability window with 400", async () => {
    const { patientToken, profile, slot } = await setupBooking();
    const res = await request(app)
      .post("/api/appointments")
      .set(auth(patientToken))
      .send(bookBody(profile._id, slot._id, { startTime: "13:00", endTime: "13:30" }));

    expect(res.status).toBe(400);
  });

  test("rejects end time before start time with 400", async () => {
    const { patientToken, profile, slot } = await setupBooking();
    const res = await request(app)
      .post("/api/appointments")
      .set(auth(patientToken))
      .send(bookBody(profile._id, slot._id, { startTime: "10:00", endTime: "09:30" }));

    expect(res.status).toBe(400);
  });

  test("rejects past dates with 400", async () => {
    const { patientToken, profile, slot } = await setupBooking();
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const res = await request(app)
      .post("/api/appointments")
      .set(auth(patientToken))
      .send(bookBody(profile._id, slot._id, { appointmentDate: past.toISOString() }));

    expect(res.status).toBe(400);
  });

  test("rejects malformed ids with 400", async () => {
    const { patientToken, profile, slot } = await setupBooking();
    const res = await request(app)
      .post("/api/appointments")
      .set(auth(patientToken))
      .send(bookBody(profile._id, slot._id, { doctorId: "nope" }));

    expect(res.status).toBe(400);
  });

  test("returns 404 for unknown doctor/slot ids", async () => {
    const { patientToken } = await setupBooking();
    const fake = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post("/api/appointments")
      .set(auth(patientToken))
      .send(bookBody(fake, fake));

    expect(res.status).toBe(404);
  });
});

describe("GET /api/appointments", () => {
  test("patients only see their own appointments", async () => {
    const first = await setupBooking();
    const secondPatient = await makeUser("patient");
    const secondSlot = await makeSlot(first.profile._id);

    await request(app)
      .post("/api/appointments")
      .set(auth(first.patientToken))
      .send(bookBody(first.profile._id, first.slot._id));
    await request(app)
      .post("/api/appointments")
      .set(auth(tokenFor(secondPatient)))
      .send({ ...bookBody(first.profile._id, secondSlot._id), startTime: "10:30", endTime: "11:00" });

    const res = await request(app).get("/api/appointments").set(auth(first.patientToken));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.pagination.total).toBe(1);
  });

  test("doctors see appointments for their own profile", async () => {
    const { patientToken, doctorToken, profile, slot } = await setupBooking();
    await request(app)
      .post("/api/appointments")
      .set(auth(patientToken))
      .send(bookBody(profile._id, slot._id));

    const res = await request(app).get("/api/appointments").set(auth(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });
});

describe("GET /api/appointments/:id", () => {
  test("rejects malformed ids with 400", async () => {
    const { patientToken } = await setupBooking();
    const res = await request(app).get("/api/appointments/nope").set(auth(patientToken));

    expect(res.status).toBe(400);
  });

  test("forbids other patients with 403", async () => {
    const { patientToken, profile, slot } = await setupBooking();
    const other = await makeUser("patient");
    const created = await request(app)
      .post("/api/appointments")
      .set(auth(patientToken))
      .send(bookBody(profile._id, slot._id));

    const res = await request(app)
      .get(`/api/appointments/${created.body.data._id}`)
      .set(auth(tokenFor(other)));

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/appointments/:id/status and DELETE /api/appointments/:id", () => {
  const bookOne = async () => {
    const ctx = await setupBooking();
    const created = await request(app)
      .post("/api/appointments")
      .set(auth(ctx.patientToken))
      .send(bookBody(ctx.profile._id, ctx.slot._id));
    return { ...ctx, appointmentId: created.body.data._id };
  };

  test("patient cancel frees the slot for rebooking", async () => {
    const { patientToken, profile, slot, appointmentId } = await bookOne();

    const cancelRes = await request(app)
      .delete(`/api/appointments/${appointmentId}`)
      .set(auth(patientToken));
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("cancelled");

    const freed = await Availability.findById(slot._id);
    expect(freed.isBooked).toBe(false);

    const other = await makeUser("patient");
    const rebook = await request(app)
      .post("/api/appointments")
      .set(auth(tokenFor(other)))
      .send(bookBody(profile._id, slot._id));
    expect(rebook.status).toBe(201);
  });

  test("patient cannot confirm, only cancel", async () => {
    const { patientToken, appointmentId } = await bookOne();
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set(auth(patientToken))
      .send({ status: "confirmed" });

    expect(res.status).toBe(403);
  });

  test("doctor can confirm then complete; terminal states are immutable", async () => {
    const { doctorToken, appointmentId } = await bookOne();

    const confirmed = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set(auth(doctorToken))
      .send({ status: "confirmed" });
    expect(confirmed.status).toBe(200);

    const completed = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set(auth(doctorToken))
      .send({ status: "completed" });
    expect(completed.status).toBe(200);

    const reopen = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set(auth(doctorToken))
      .send({ status: "cancelled" });
    expect(reopen.status).toBe(400);
  });

  test("rejects invalid status values with 400", async () => {
    const { doctorToken, appointmentId } = await bookOne();
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set(auth(doctorToken))
      .send({ status: "teleported" });

    expect(res.status).toBe(400);
  });

  test("forbids cancelling someone else's appointment", async () => {
    const { appointmentId } = await bookOne();
    const other = await makeUser("patient");
    const res = await request(app)
      .delete(`/api/appointments/${appointmentId}`)
      .set(auth(tokenFor(other)));

    expect(res.status).toBe(403);
  });
});
