import { Router } from "express";
import bcrypt from "bcryptjs";
import { env } from "../config";
import { ApiError } from "../errors";
import { authCookieOptions, requireAuth, signAccessToken } from "../middleware/auth";
import { User } from "../models/User";
import { loginSchema, resendOtpSchema, signupSchema, verifyOtpSchema } from "../schemas";
import { generateOtp, getOtpExpiryDate, sendVerificationOtp } from "../services/authEmailService";
import { asyncHandler } from "../utils/asyncHandler";

export const authRouter = Router();

function publicUser(user: { _id: unknown; email: string }) {
  return {
    id: String(user._id),
    email: user.email
  };
}

async function buildOtpFields() {
  const otp = generateOtp();

  return {
    otp,
    otpHash: await bcrypt.hash(otp, 12),
    otpExpiresAt: getOtpExpiryDate()
  };
}

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const existing = await User.findOne({ email: input.email });

    if (existing?.isVerified) {
      throw new ApiError(409, "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const otpFields = await buildOtpFields();

    const user =
      existing ??
      new User({
        email: input.email
      });

    user.passwordHash = passwordHash;
    user.isVerified = false;
    user.otpHash = otpFields.otpHash;
    user.otpExpiresAt = otpFields.otpExpiresAt;

    await user.save();
    await sendVerificationOtp(user.email, otpFields.otp);

    res.status(existing ? 200 : 201).json({
      message: "Verification code sent to your email",
      email: user.email
    });
  })
);

authRouter.post(
  "/verify-otp",
  asyncHandler(async (req, res) => {
    const input = verifyOtpSchema.parse(req.body);
    const user = await User.findOne({ email: input.email });

    if (!user) {
      throw new ApiError(400, "Invalid or expired OTP");
    }

    if (user.isVerified) {
      return res.json({
        message: "Email is already verified",
        email: user.email
      });
    }

    if (!user.otpHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      throw new ApiError(400, "Invalid or expired OTP");
    }

    const ok = await bcrypt.compare(input.otp, user.otpHash);

    if (!ok) {
      throw new ApiError(400, "Invalid or expired OTP");
    }

    user.isVerified = true;
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    res.json({
      message: "Email verified successfully. You can now login.",
      email: user.email
    });
  })
);

authRouter.post(
  "/resend-otp",
  asyncHandler(async (req, res) => {
    const input = resendOtpSchema.parse(req.body);
    const user = await User.findOne({ email: input.email });

    if (!user) {
      return res.json({
        message: "If an unverified account exists, a new code has been sent"
      });
    }

    if (user.isVerified) {
      throw new ApiError(409, "This email is already verified");
    }

    const otpFields = await buildOtpFields();
    user.otpHash = otpFields.otpHash;
    user.otpExpiresAt = otpFields.otpExpiresAt;
    await user.save();

    await sendVerificationOtp(user.email, otpFields.otp);

    res.json({
      message: "A new verification code has been sent"
    });
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

    if (!user.isVerified) {
      throw new ApiError(403, "Please verify your email before logging in");
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