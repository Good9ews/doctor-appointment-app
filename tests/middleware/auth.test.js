jest.mock("../../src/models/User");

const User = require("../../src/models/User");
const { authenticate } = require("../../src/middleware/auth");
const { signToken } = require("../../src/services/token/jwt");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("authenticate middleware", () => {
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

  test("rejects with 401 when the user no longer exists", async () => {
    const token = signToken({ sub: "deleted-user-id" });
    User.findById.mockResolvedValue(null);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(User.findById).toHaveBeenCalledWith("deleted-user-id");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next() and attaches req.user for a valid token", async () => {
    const fakeUser = { _id: "user-123", email: "a@b.com" };
    const token = signToken({ sub: "user-123" });
    User.findById.mockResolvedValue(fakeUser);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(req.user).toBe(fakeUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
