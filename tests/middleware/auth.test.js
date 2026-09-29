jest.mock("../../src/models/User");
jest.mock("../../src/services/token/revocation");

const jwt = require("jsonwebtoken");
const User = require("../../src/models/User");
const { isTokenRevoked } = require("../../src/services/token/revocation");
const { authenticate } = require("../../src/middleware/auth");
const { signToken } = require("../../src/services/token/jwt");

const VALID_SUB = "507f1f77bcf86cd799439011";
const OTHER_VALID_SUB = "507f191e810c19729de860ea";

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("authenticate middleware", () => {
  beforeEach(() => {
    isTokenRevoked.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("rejects with 401 when Authorization header is missing", async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects with 401 when scheme is not Bearer", async () => {
    const req = { headers: { authorization: "Basic sometoken" } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects with 401 when the token is invalid", async () => {
    const req = { headers: { authorization: "Bearer garbage-token" } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects with 401 when the token has no jti, without calling isTokenRevoked", async () => {
    const token = jwt.sign({ sub: VALID_SUB }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1h",
    });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(isTokenRevoked).not.toHaveBeenCalled();
  });

  test("rejects with 401 when the token's sub is not a valid ObjectId", async () => {
    const token = jwt.sign({ sub: "not-an-object-id", jti: "some-jti" }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1h",
    });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects with 401 when the token has been revoked", async () => {
    const token = signToken({ sub: VALID_SUB });
    isTokenRevoked.mockResolvedValue(true);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(User.findById).not.toHaveBeenCalled();
  });

  test("rejects with 401 when the user no longer exists", async () => {
    const token = signToken({ sub: OTHER_VALID_SUB });
    User.findById.mockResolvedValue(null);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(OTHER_VALID_SUB);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects with 503 when the revocation check fails (e.g. the database is unreachable), not 401", async () => {
    const token = signToken({ sub: VALID_SUB });
    isTokenRevoked.mockRejectedValue(new Error("connection timed out"));

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects with 503 when the user lookup fails for a well-formed token, not 401", async () => {
    const token = signToken({ sub: VALID_SUB });
    User.findById.mockRejectedValue(new Error("connection timed out"));

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next() and attaches req.user and req.tokenPayload for a valid token", async () => {
    const fakeUser = { _id: VALID_SUB, email: "a@b.com" };
    const token = signToken({ sub: VALID_SUB });
    User.findById.mockResolvedValue(fakeUser);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(req.user).toBe(fakeUser);
    expect(req.tokenPayload.sub).toBe(VALID_SUB);
    expect(req.tokenPayload.jti).toEqual(expect.any(String));
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
