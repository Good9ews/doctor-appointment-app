const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const User = require("../src/models/User");
const Doctor = require("../src/models/Doctor");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { serverSelectionTimeoutMS: 10000 });
}, 60000);

afterEach(async () => {
  await User.deleteMany({});
  await Doctor.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const makeUser = (overrides = {}) =>
  User.create({
    name: "Greg House",
    email: `house-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
    password: "correcthorsebattery",
    role: "doctor",
    ...overrides,
  });

const validProfile = (userId) => ({
  user: userId.toString(),
  name: "Greg House",
  specialization: "Diagnostics",
  email: "house@example.com",
  phone: "+15551234567",
  location: "Princeton",
  bio: "Diagnostician.",
});

describe("POST /api/doctors", () => {
  test("creates a doctor profile (happy path)", async () => {
    const user = await makeUser();
    const res = await request(app).post("/api/doctors").send(validProfile(user._id));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Greg House");
    expect(res.body.data.user.role).toBe("doctor");
  });

  test("rejects missing fields with 400", async () => {
    const user = await makeUser();
    const body = validProfile(user._id);
    delete body.phone;

    const res = await request(app).post("/api/doctors").send(body);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("rejects an invalid email with 400", async () => {
    const user = await makeUser();
    const res = await request(app)
      .post("/api/doctors")
      .send({ ...validProfile(user._id), email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("rejects a non-ObjectId user with 400", async () => {
    const res = await request(app)
      .post("/api/doctors")
      .send({ ...validProfile(new mongoose.Types.ObjectId()), user: "nope" });

    expect(res.status).toBe(400);
  });

  test("returns 404 for an unknown user id", async () => {
    const res = await request(app)
      .post("/api/doctors")
      .send(validProfile(new mongoose.Types.ObjectId()));

    expect(res.status).toBe(404);
  });

  test("rejects a user without the doctor role with 400", async () => {
    const patient = await makeUser({ role: "patient" });
    const res = await request(app).post("/api/doctors").send(validProfile(patient._id));

    expect(res.status).toBe(400);
  });

  test("rejects a duplicate profile for the same user with 409", async () => {
    const user = await makeUser();
    await request(app).post("/api/doctors").send(validProfile(user._id));
    const res = await request(app).post("/api/doctors").send(validProfile(user._id));

    expect(res.status).toBe(409);
  });
});

describe("GET /api/doctors/:id", () => {
  test("rejects a malformed id with 400 (no 500 CastError)", async () => {
    const res = await request(app).get("/api/doctors/not-an-id");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("invalid doctor id");
  });

  test("returns 404 for a well-formed but unknown id", async () => {
    const res = await request(app).get(`/api/doctors/${new mongoose.Types.ObjectId()}`);

    expect(res.status).toBe(404);
  });

  test("returns the profile for a known id", async () => {
    const user = await makeUser();
    const created = await request(app).post("/api/doctors").send(validProfile(user._id));

    const res = await request(app).get(`/api/doctors/${created.body.data._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Greg House");
  });
});

describe("PUT /api/doctors/:id", () => {
  test("rejects a malformed id with 400", async () => {
    const res = await request(app).put("/api/doctors/not-an-id").send({ location: "X" });

    expect(res.status).toBe(400);
  });

  test("rejects an invalid email with 400", async () => {
    const user = await makeUser();
    const created = await request(app).post("/api/doctors").send(validProfile(user._id));

    const res = await request(app)
      .put(`/api/doctors/${created.body.data._id}`)
      .send({ email: "bad" });

    expect(res.status).toBe(400);
  });

  test("updates allowed fields (happy path)", async () => {
    const user = await makeUser();
    const created = await request(app).post("/api/doctors").send(validProfile(user._id));

    const res = await request(app)
      .put(`/api/doctors/${created.body.data._id}`)
      .send({ location: "New York", bio: "Updated bio." });

    expect(res.status).toBe(200);
    expect(res.body.data.location).toBe("New York");
    expect(res.body.data.bio).toBe("Updated bio.");
  });
});

describe("DELETE /api/doctors/:id", () => {
  test("rejects a malformed id with 400", async () => {
    const res = await request(app).delete("/api/doctors/not-an-id");

    expect(res.status).toBe(400);
  });

  test("returns 404 for a well-formed but unknown id", async () => {
    const res = await request(app).delete(`/api/doctors/${new mongoose.Types.ObjectId()}`);

    expect(res.status).toBe(404);
  });

  test("deletes a known profile", async () => {
    const user = await makeUser();
    const created = await request(app).post("/api/doctors").send(validProfile(user._id));

    const res = await request(app).delete(`/api/doctors/${created.body.data._id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("route mounting", () => {
  test("/api/doctors router is mounted exactly once", async () => {
    await request(app).get("/"); // force Express 5 lazy-router init
    const doctorRoutes = require("../src/routes/doctorRoutes");
    const mounts = (app.router?.stack ?? []).filter((layer) => layer.handle === doctorRoutes);

    expect(mounts.length).toBe(1);
  });
});
