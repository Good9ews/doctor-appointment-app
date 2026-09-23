const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const User = require("../src/models/User");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { serverSelectionTimeoutMS: 10000 });
}, 60000);

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const validPatient = {
  name: "Jane Patient",
  email: "jane@example.com",
  password: "correcthorsebattery",
  role: "patient",
};

describe("POST /api/auth/register", () => {
  test("registers a new user and returns a token (happy path)", async () => {
    const res = await request(app).post("/api/auth/register").send(validPatient);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(validPatient.email);
    expect(res.body.user.password).toBeUndefined();
  });

  test("rejects duplicate email registration with 409", async () => {
    await request(app).post("/api/auth/register").send(validPatient);
    const res = await request(app).post("/api/auth/register").send(validPatient);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test("rejects a password shorter than 8 characters with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validPatient, password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("rejects a password longer than 72 bytes with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validPatient, password: "a".repeat(73) });

    expect(res.status).toBe(400);
  });

  test("rejects an invalid role with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validPatient, role: "admin" });

    expect(res.status).toBe(400);
  });

  test("rejects an empty request body with 400", async () => {
    const res = await request(app).post("/api/auth/register").send({});

    expect(res.status).toBe(400);
  });

  test("stores the password as a bcrypt hash, never in plaintext", async () => {
    await request(app).post("/api/auth/register").send(validPatient);

    const stored = await User.findOne({ email: validPatient.email }).select("+password");
    expect(stored.password).not.toBe(validPatient.password);
    expect(stored.password).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  test("a race between two identical registrations yields one 201 and one 409, never a 500", async () => {
    const [first, second] = await Promise.all([
      request(app).post("/api/auth/register").send(validPatient),
      request(app).post("/api/auth/register").send(validPatient),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const count = await User.countDocuments({ email: validPatient.email });
    expect(count).toBe(1);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(validPatient);
  });

  test("logs in with correct credentials (happy path)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validPatient.email, password: validPatient.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test("rejects a wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validPatient.email, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  test("rejects a non-existent email with 401 (no user enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.message).not.toMatch(/exist|found/i);
  });

  test("rejects an array-typed email with 400 instead of coercing it", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: [validPatient.email], password: validPatient.password });

    expect(res.status).toBe(400);
  });

  test("accepts a lowercase 'bearer' scheme on subsequent /me calls", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: validPatient.email, password: validPatient.password });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  test("rejects a request with no token with 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("rejects a request with a malformed token with 401", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  test("returns the authenticated user for a valid token (happy path)", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(validPatient);
    const token = registerRes.body.token;

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validPatient.email);
  });

  test("rejects an expired token with 401", async () => {
    const jwt = require("jsonwebtoken");
    const registerRes = await request(app).post("/api/auth/register").send(validPatient);
    const decoded = jwt.decode(registerRes.body.token);
    const expiredToken = jwt.sign({ sub: decoded.sub, role: decoded.role }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: -1,
    });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  test("rejects a token for a user that was since deleted with 401", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(validPatient);
    const token = registerRes.body.token;

    await User.deleteMany({});

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

describe("error response shape", () => {
  test("returns JSON (not HTML) for an unknown route", async () => {
    const res = await request(app).get("/api/auth/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.type).toBe("application/json");
    expect(res.body.success).toBe(false);
  });

  test("returns JSON for malformed request bodies instead of an HTML stack trace", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{ not valid json");

    expect(res.status).toBe(400);
    expect(res.type).toBe("application/json");
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules|at model|at Object/);
  });

  test("returns JSON for an oversized request body instead of an HTML stack trace", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validPatient, name: "x".repeat(200 * 1024) });

    expect(res.status).toBe(413);
    expect(res.type).toBe("application/json");
  });
});
