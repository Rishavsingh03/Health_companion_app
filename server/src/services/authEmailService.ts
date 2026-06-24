import { randomInt } from "node:crypto";
import nodemailer from "nodemailer";

const OTP_EXPIRY_MINUTES = 10;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMailTransport() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!user || !pass) {
    throw new Error("EMAIL_USER and EMAIL_PASSWORD are required for verification emails");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass
    }
  });
}

function buildOtpEmail(otp: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Verify your Health Companion email</h2>
      <p style="margin: 0 0 16px;">Use this code to finish creating your account:</p>
      <div style="display: inline-block; padding: 12px 18px; border-radius: 6px; background: #ecfdf5; color: #047857; font-size: 24px; font-weight: bold; letter-spacing: 4px;">
        ${escapeHtml(otp)}
      </div>
      <p style="margin-top: 18px; font-size: 13px; color: #475569;">
        This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this account, you can ignore this email.
      </p>
    </div>
  `;
}

export function generateOtp() {
  return randomInt(100000, 1000000).toString();
}

export function getOtpExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

export async function sendVerificationOtp(email: string, otp: string) {
  const transporter = getMailTransport();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Verify your Health Companion email",
    html: buildOtpEmail(otp)
  });
}