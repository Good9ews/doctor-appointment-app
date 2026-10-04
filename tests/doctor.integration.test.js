const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const User = require("../src/models/User");
const Doctor = require("../src/models/Doctor");
const { signToken } = require("../src/services/token/jwt");

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

const tokenFor = (user) => signToken({ sub: user._id.toString(), role: user.role });
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const validProfile = (userId) => ({
  user: userId.toString(),
  name: "Greg House",
  specialization: "Diagnostics",
  email: "house@example.com",
  phone: "+15551234567",
  location: "Princeton",
  bio: "Diagnostician.",
});

const createProfile = (user) =>
  request(app).post("/api/doctors").set(auth(tokenFor(user))).send(validProfile(user._id));

describe("POST /api/doctors", () => {
  test("creates a doctor profile (happy path)", async () => {
    const user = await makeUser();
    const res = await createProfile(user);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Greg House");
    expect(res.body.data.user.role).toBe("doctor");
  });

  test("rejects missing fields with 400", async () => {
    const user = await makeUser();
    const body = validProfile(user._id);
    delete body.phone;

    const res = await request(app).post("/api/doctors").set(auth(tokenFor(user))).send(body);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("rejects an invalid email with 400", async () => {
    const user = await makeUser();
    const res = await request(app)
      .post("/api/doctors")
      .set(auth(tokenFor(user)))
      .send({ ...validProfile(user._id), email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("ignores a user field in the body and links the caller's account", async () => {
    // The controller derives the owner from the token, never the body.
    const user = await makeUser();
    const res = await request(app)
      .post("/api/doctors")
      .set(auth(tokenFor(user)))
      .send({ ...validProfile(new mongoose.Types.ObjectId()), user: "nope" });

    expect(res.status).toBe(201);
    expect(res.body.data.user._id.toString()).toBe(user._id.toString());
  });

  test("rejects patients with 403", async () => {
    const patient = await makeUser({ role: "patient" });
    const res = await request(app)
      .post("/api/doctors")
      .set(auth(tokenFor(patient)))
      .send(validProfile(patient._id));

    expect(res.status).toBe(403);
  });

  test("a user field for another account is ignored; caller gets own profile", async () => {
    const first = await makeUser();
    const second = await makeUser();
    const res = await request(app)
      .post("/api/doctors")
      .set(auth(tokenFor(first)))
      .send(validProfile(second._id));

    expect(res.status).toBe(201);
    expect(res.body.data.user._id.toString()).toBe(first._id.toString());
  });

  test("rejects a duplicate profile for the same user with 409", async () => {
    const user = await makeUser();
    await createProfile(user);
    const res = await createProfile(user);

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
    const created = await createProfile(user);

    const res = await request(app).get(`/api/doctors/${created.body.data._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Greg House");
  });
});

describe("PUT /api/doctors/:id", () => {
  test("rejects a malformed id with 400", async () => {
    const user = await makeUser();
    const res = await request(app)
      .put("/api/doctors/not-an-id")
      .set(auth(tokenFor(user)))
      .send({ location: "X" });

    expect(res.status).toBe(400);
  });

  test("rejects an invalid email with 400", async () => {
    const user = await makeUser();
    const created = await createProfile(user);

    const res = await request(app)
      .put(`/api/doctors/${created.body.data._id}`)
      .set(auth(tokenFor(user)))
      .send({ email: "bad" });

    expect(res.status).toBe(400);
  });

  test("updates allowed fields (happy path)", async () => {
    const user = await makeUser();
    const created = await createProfile(user);

    const res = await request(app)
      .put(`/api/doctors/${created.body.data._id}`)
      .set(auth(tokenFor(user)))
      .send({ location: "New York", bio: "Updated bio." });

    expect(res.status).toBe(200);
    expect(res.body.data.location).toBe("New York");
    expect(res.body.data.bio).toBe("Updated bio.");
  });

  test("rejects updating another doctor's profile with 403", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const created = await createProfile(owner);

    const res = await request(app)
      .put(`/api/doctors/${created.body.data._id}`)
      .set(auth(tokenFor(other)))
      .send({ location: "Elsewhere" });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/doctors/:id", () => {
  test("rejects a malformed id with 400", async () => {
    const user = await makeUser();
    const res = await request(app)
      .delete("/api/doctors/not-an-id")
      .set(auth(tokenFor(user)));

    expect(res.status).toBe(400);
  });

  test("returns 404 for a well-formed but unknown id", async () => {
    const user = await makeUser();
    const res = await request(app)
      .delete(`/api/doctors/${new mongoose.Types.ObjectId()}`)
      .set(auth(tokenFor(user)));

    expect(res.status).toBe(404);
  });

  test("deletes a known profile", async () => {
    const user = await makeUser();
    const created = await createProfile(user);

    const res = await request(app)
      .delete(`/api/doctors/${created.body.data._id}`)
      .set(auth(tokenFor(user)));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("rejects deleting another doctor's profile with 403", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const created = await createProfile(owner);

    const res = await request(app)
      .delete(`/api/doctors/${created.body.data._id}`)
      .set(auth(tokenFor(other)));

    expect(res.status).toBe(403);
  });
});

describe("doctor write auth", () => {
  test("unauthenticated writes get 401", async () => {
    const user = await makeUser();
    const created = await createProfile(user);
    const id = created.body.data._id;

    const [post, put, del] = await Promise.all([
      request(app).post("/api/doctors").send(validProfile(user._id)),
      request(app).put(`/api/doctors/${id}`).send({ location: "X" }),
      request(app).delete(`/api/doctors/${id}`),
    ]);

    expect(post.status).toBe(401);
    expect(put.status).toBe(401);
    expect(del.status).toBe(401);
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
