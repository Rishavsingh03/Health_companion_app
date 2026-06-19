import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config";
import { ApiError } from "../errors";

type TokenPayload = {
  sub: string;
  email: string;
};

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.COOKIE_SECURE,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[env.COOKIE_NAME];

  if (!token) {
    return next(new ApiError(401, "Authentication required"));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;

    if (!decoded.sub || typeof decoded.email !== "string") {
      throw new Error("Invalid token payload");
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email
    };

    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired session"));
  }
}

