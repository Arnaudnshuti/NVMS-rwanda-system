import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { hashPassword, verifyPassword, signAccessToken } from "../services/auth.service.js";
import { serializeUserWithDocs } from "../services/user.service.js";
import { requireAuth, type AuthRequest } from "../middlewares/auth.middleware.js";
import { writeAudit } from "../services/audit.service.js";
import { sendTemplatedEmail } from "../services/email/mailer.js";
import { createNotification } from "../services/notification.service.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  district: z.string().min(1).optional(),
  districtId: z.string().min(1).optional(),
  phone: z.string().min(3),
  password: z.string().min(8),
  contactPreference: z.enum(["email", "sms", "both"]),
  dateOfBirth: z.string().optional(),
  profession: z.string().optional(),
  educationLevel: z.string().optional(),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }
  const body = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (exists) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const passwordHash = await hashPassword(body.password);
  const dob = body.dateOfBirth ? new Date(body.dateOfBirth) : undefined;
  let districtId: string | undefined = undefined;
  let districtName: string | undefined = body.district?.trim();
  if (body.districtId) {
    const d = await prisma.district.findUnique({ where: { id: body.districtId } });
    if (!d || !d.isActive) return res.status(400).json({ error: "Invalid districtId" });
    districtId = d.id;
    districtName = d.name;
  }

  const user = await prisma.user.create({
    data: {
      email: body.email.trim().toLowerCase(),
      passwordHash,
      name: body.name.trim(),
      role: "volunteer",
      isActive: true,
      mustChangePassword: false,
      district: districtName,
      districtId,
      phone: body.phone.trim(),
      verificationStatus: "pending",
      profileTrustStatus: "unsubmitted",
      contactPreference: body.contactPreference,
      dateOfBirth: dob && !Number.isNaN(dob.getTime()) ? dob : undefined,
      profession: body.profession?.trim(),
      educationLevel: body.educationLevel?.trim(),
      skills: [],
    },
  });

  const link = process.env.SYSTEM_LOGIN_LINK ?? "http://localhost:5173/login";
  await sendTemplatedEmail({
    templateId: "volunteer_registration_received",
    to: user.email,
    targetUserId: user.id,
    vars: {
      name: user.name,
      district: user.district ?? "your district",
      link,
      role: "volunteer",
      email: user.email,
    },
  });

  return res.status(201).json({
    message: "Registration received. Sign in after your coordinator approves your account.",
    userId: user.id,
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid credentials payload" });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await writeAudit("AUTH_LOGIN_FAILURE", { req, metadata: { email, reason: "not_found" } });
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    await writeAudit("AUTH_LOGIN_FAILURE", { req, metadata: { email, userId: user.id, reason: "bad_password" } });
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (user.govStatus === "revoked") {
    await writeAudit("AUTH_LOGIN_FAILURE", { req, metadata: { email, userId: user.id, reason: "revoked" } });
    return res.status(403).json({ error: "Your access has been revoked. Contact MINALOC ICT support." });
  }
  if (user.govStatus === "suspended") {
    await writeAudit("AUTH_LOGIN_FAILURE", { req, metadata: { email, userId: user.id, reason: "suspended" } });
    return res.status(403).json({ error: "Your account is suspended. Contact MINALOC ICT support." });
  }
  if (!user.isActive) {
    await writeAudit("AUTH_LOGIN_FAILURE", { req, metadata: { email, userId: user.id, reason: "inactive" } });
    return res.status(403).json({ error: "Your account is deactivated. Contact MINALOC support." });
  }

  if (user.role === "coordinator" && user.mustChangePassword) {
    const ageMs = Date.now() - user.createdAt.getTime();
    const maxAgeMs = 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) {
      await writeAudit("AUTH_LOGIN_FAILURE", { req, metadata: { email, userId: user.id, reason: "temporary_credentials_expired" } });
      await createNotification({
        userId: user.id,
        type: "WARNING",
        title: "Temporary credentials expired",
        message: "Your initial invitation expired. Contact MINALOC admin for a password reset.",
        metadata: { reason: "temporary_credentials_expired" },
      });
      return res.status(403).json({
        error: "Temporary invitation expired after 24 hours. Contact admin for credential reset.",
      });
    }
  }

  if (user.role === "volunteer" && user.verificationStatus === "pending") {
    await writeAudit("AUTH_LOGIN_FAILURE", { req, metadata: { email, userId: user.id, reason: "volunteer_pending" } });
    return res.status(403).json({
      error: "Your account is pending district approval. Sign in after your coordinator approves your registration.",
    });
  }
  if (user.role === "volunteer" && user.verificationStatus === "rejected") {
    await writeAudit("AUTH_LOGIN_FAILURE", { req, metadata: { email, userId: user.id, reason: "volunteer_rejected" } });
    return res.status(403).json({
      error: "Your registration was not approved. Contact your district coordinator or MINALOC.",
    });
  }

  await writeAudit("AUTH_LOGIN_SUCCESS", { actorUserId: user.id, req, metadata: { email, role: user.role } });

  const token = signAccessToken({ sub: user.id, role: user.role });
  const publicUser = await serializeUserWithDocs(user);
  return res.json({ token, user: publicUser, mustChangePassword: user.mustChangePassword === true });
});

authRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(401).json({ error: "User not found" });
  return res.json(await serializeUserWithDocs(user));
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post("/change-password", requireAuth, async (req: AuthRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!user.isActive || user.govStatus !== "active") {
    return res.status(403).json({ error: "Account inactive. Contact administrator." });
  }

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return res.status(400).json({ error: "Current password is incorrect" });

  const nextHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: nextHash, mustChangePassword: false },
  });

  await writeAudit("AUTH_PASSWORD_CHANGED", {
    actorUserId: user.id,
    targetUserId: user.id,
    req,
    metadata: { mustChangePasswordWas: user.mustChangePassword },
  });

  res.json({ message: "Password changed successfully" });
});
