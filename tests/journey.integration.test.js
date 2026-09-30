const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const User = require("../src/models/User");
const Doctor = require("../src/models/Doctor");
const Availability = require("../src/models/Availability");
const Appointment = require("../src/models/Appointment");

// End-to-end patient journey across every domain: auth -> doctor profile ->
// slot -> booking -> status changes -> cancel/rebook -> logout. Catches
// wiring breaks between domains that per-file suites can miss.
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { serverSelectionTimeoutMS: 10000 });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test("full journey: register, profile, slot, book, confirm, cancel, rebook, logout", async () => {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // 1. Register a doctor and a patient.
  const doctorReg = await request(app).post("/api/auth/register").send({
    name: "Greg House",
    email: `house-${stamp}@example.com`,
    password: "correcthorsebattery",
    role: "doctor",
  });
  expect(doctorReg.status).toBe(201);
  const doctorToken = doctorReg.body.token;
  const doctorAuth = { Authorization: `Bearer ${doctorToken}` };

  const patientReg = await request(app).post("/api/auth/register").send({
    name: "Jane Patient",
    email: `jane-${stamp}@example.com`,
    password: "correcthorsebattery",
    role: "patient",
  });
  expect(patientReg.status).toBe(201);
  const patientToken = patientReg.body.token;
  const patientAuth = { Authorization: `Bearer ${patientToken}` };

  // 2. Doctor creates their profile.
  const profile = await request(app)
    .post("/api/doctors")
    .set(doctorAuth)
    .send({
      user: doctorReg.body.user.id,
      name: "Greg House",
      specialization: "Diagnostics",
      email: `house-${stamp}@example.com`,
      phone: "+15551234567",
      location: "Princeton",
    });
  expect(profile.status).toBe(201);
  const doctorId = profile.body.data._id;

  // 3. Doctor publishes a slot; patient finds it via the public directory.
  const future = new Date();
  future.setDate(future.getDate() + 7);
  const slot = await request(app).post("/api/availability").set(doctorAuth).send({
    doctor: doctorId,
    date: future.toISOString(),
    startTime: "09:00",
    endTime: "12:00",
  });
  expect(slot.status).toBe(201);

  const browse = await request(app).get(`/api/availability/doctor/${doctorId}`);
  expect(browse.status).toBe(200);
  expect(browse.body.count).toBe(1);

  // 4. Patient books, reads, and the doctor confirms.
  const booking = await request(app).post("/api/appointments").set(patientAuth).send({
    doctorId,
    availabilityId: slot.body.data._id,
    appointmentDate: future.toISOString(),
    startTime: "09:30",
    endTime: "10:00",
  });
  expect(booking.status).toBe(201);
  const appointmentId = booking.body.data._id;

  const mine = await request(app).get("/api/appointments").set(patientAuth);
  expect(mine.status).toBe(200);
  expect(mine.body.count).toBe(1);

  const confirmed = await request(app)
    .patch(`/api/appointments/${appointmentId}/status`)
    .set(doctorAuth)
    .send({ status: "confirmed" });
  expect(confirmed.status).toBe(200);

  // 5. Patient cancels; the freed slot is rebookable.
  const cancelled = await request(app)
    .delete(`/api/appointments/${appointmentId}`)
    .set(patientAuth);
  expect(cancelled.status).toBe(200);

  const freed = await Availability.findById(slot.body.data._id);
  expect(freed.isBooked).toBe(false);

  const rebook = await request(app).post("/api/appointments").set(patientAuth).send({
    doctorId,
    availabilityId: slot.body.data._id,
    appointmentDate: future.toISOString(),
    startTime: "10:30",
    endTime: "11:00",
  });
  expect(rebook.status).toBe(201);

  // 6. Logout revokes the token: it stops working immediately.
  const logout = await request(app).post("/api/auth/logout").set(patientAuth);
  expect(logout.status).toBe(200);

  const afterLogout = await request(app).get("/api/auth/me").set(patientAuth);
  expect(afterLogout.status).toBe(401);

  await User.deleteMany({});
  await Doctor.deleteMany({});
  await Availability.deleteMany({});
  await Appointment.deleteMany({});
}, 60000);

test("shipped OpenAPI spec covers appointments after the stack merge", async () => {
  const res = await request(app).get("/api-docs.json");

  expect(res.status).toBe(200);
  expect(res.body.paths["/api/appointments"]).toBeDefined();
  expect(res.body.paths["/api/appointments/{id}"]).toBeDefined();
  expect(res.body.paths["/api/appointments/{id}/status"]).toBeDefined();
});
