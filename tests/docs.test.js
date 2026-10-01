// No database needed: the spec is generated from JSDoc annotations at
// require-time, and both doc routes are plain GETs.
const request = require("supertest");
const app = require("../src/app");
const { openApiSpec } = require("../src/docs/openapi");

const EXPECTED_PATHS = [
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/doctors",
  "/api/doctors/{id}",
  "/api/availability",
  "/api/availability/doctor/{doctorId}",
  "/api/availability/{id}",
];

describe("API docs", () => {
  test("spec is OpenAPI 3.0 with every documented path", () => {
    expect(openApiSpec.openapi).toMatch(/^3\.0\./);
    for (const path of EXPECTED_PATHS) {
      expect(openApiSpec.paths[path]).toBeDefined();
    }
    // Appointment paths appear once PR #11 (feature/appointment-booking)
    // merges -- its annotations ride the same src/routes/*.js glob.
  });

  test("GET /api-docs.json serves the spec", async () => {
    const res = await request(app).get("/api-docs.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\.0\./);
    expect(res.body.paths["/api/doctors"]).toBeDefined();
  });

  test("GET /api-docs serves the Scalar UI", async () => {
    const res = await request(app).get("/api-docs");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });
});
