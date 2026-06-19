import { Router } from "express";
import bcrypt from "bcryptjs";
import { env } from "../config";
import { ApiError } from "../errors";
import { authCookieOptions, requireAuth, signAccessToken } from "../middleware/auth";
import { User } from "../models/User";
import { loginSchema, signupSchema } from "../schemas";
import { asyncHandler } from "../utils/asyncHandler";

export const authRouter = Router();

function publicUser(user: { _id: unknown; email: string }) {
  return {
    id: String(user._id),
    email: user.email
  };
}

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const existing = await User.findOne({ email: input.email });

    if (existing) {
      throw new ApiError(409, "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({
      email: input.email,
      passwordHash
    });

    const token = signAccessToken({ sub: user._id.toString(), email: user.email });

    res.cookie(env.COOKIE_NAME, token, authCookieOptions);
    res.status(201).json({ user: publicUser(user) });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email });

    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);

    if (!ok) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = signAccessToken({ sub: user._id.toString(), email: user.email });

    res.cookie(env.COOKIE_NAME, token, authCookieOptions);
    res.json({ user: publicUser(user) });
  })
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, authCookieOptions);
  res.status(204).send();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

