import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { requireAuth, requireRoles, type AuthRequest } from "../middlewares/auth.middleware.js";
import { hashPassword } from "../services/auth.service.js";
import { writeAudit } from "../services/audit.service.js";
import { sendTemplatedEmail } from "../services/email/mailer.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRoles("admin"));

const createCoordinatorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  district: z.string().min(1).optional(),
  districtId: z.string().min(1).optional(),
  phone: z.string().min(3).optional(),
  temporaryPassword: z.string().min(8).optional(),
});

function generateTemporaryPassword() {
  return `NVMS-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString().slice(-4)}`;
}

adminRouter.post("/users", async (req: AuthRequest, res) => {
  const parsed = createCoordinatorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const email = parsed.data.email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "User with this email already exists" });

  let districtId: string | undefined = undefined;
  let districtName: string | undefined = parsed.data.district?.trim();
  if (parsed.data.districtId) {
    const d = await prisma.district.findUnique({ where: { id: parsed.data.districtId } });
    if (!d || !d.isActive) return res.status(400).json({ error: "Invalid districtId" });
    districtId = d.id;
    districtName = d.name;
  }
  if (!districtName) return res.status(400).json({ error: "district or districtId is required" });

  const tempPassword = parsed.data.temporaryPassword ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);

  const created = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      role: "coordinator",
      district: districtName,
      districtId,
      phone: parsed.data.phone?.trim(),
      passwordHash,
      isActive: true,
      mustChangePassword: true,
      govStatus: "active",
      verificationStatus: "verified",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      district: true,
      districtId: true,
      phone: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  await writeAudit("ADMIN_COORDINATOR_CREATED", {
    actorUserId: req.userId,
    targetUserId: created.id,
    req,
    metadata: { role: "coordinator", district: created.district, districtId: created.districtId, email: created.email },
  });

  const link = process.env.SYSTEM_LOGIN_LINK ?? "http://localhost:5173/login";
  await sendTemplatedEmail({
    templateId: "coordinator_invite",
    to: created.email,
    actorUserId: req.userId,
    targetUserId: created.id,
    vars: {
      name: created.name,
      email: created.email,
      password: tempPassword,
      link,
      role: "coordinator",
      district: created.district ?? "",
    },
  });

  res.status(201).json({ user: created, temporaryPassword: tempPassword });
});

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      district: true,
      phone: true,
      isActive: true,
      mustChangePassword: true,
      govStatus: true,
      verificationStatus: true,
      profileTrustStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res.json(users);
});

adminRouter.get("/audit-logs", async (req: AuthRequest, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const take = Math.min(200, Math.max(1, Number(req.query.take ?? 100) || 100));

  const logs = await prisma.auditLog.findMany({
    take,
    orderBy: { createdAt: "desc" },
    where: q
      ? {
          OR: [
            { actionType: { equals: q.toUpperCase() as never } },
            { metadata: { path: ["email"], string_contains: q } },
            { metadata: { path: ["to"], string_contains: q } },
          ],
        }
      : undefined,
    select: {
      id: true,
      actionType: true,
      actorUserId: true,
      targetUserId: true,
      ip: true,
      userAgent: true,
      metadata: true,
      createdAt: true,
    },
  });

  res.json(logs);
});

adminRouter.get("/platform-config", async (_req, res) => {
  const row = await prisma.platformConfig.findUnique({ where: { id: 1 } });
  if (!row) {
    return res.json({
      volunteerCategories: [],
      programTypes: [],
    });
  }
  res.json({
    volunteerCategories: row.volunteerCategories as string[],
    programTypes: row.programTypes as string[],
  });
});

const platformSchema = z.object({
  volunteerCategories: z.array(z.string()),
  programTypes: z.array(z.string()),
});

adminRouter.put("/platform-config", async (req: AuthRequest, res) => {
  const parsed = platformSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const row = await prisma.platformConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      volunteerCategories: parsed.data.volunteerCategories.filter(Boolean),
      programTypes: parsed.data.programTypes.filter(Boolean),
    },
    update: {
      volunteerCategories: parsed.data.volunteerCategories.filter(Boolean),
      programTypes: parsed.data.programTypes.filter(Boolean),
    },
  });

  res.json({
    volunteerCategories: row.volunteerCategories as string[],
    programTypes: row.programTypes as string[],
  });
});

const govSchema = z.object({
  govStatus: z.enum(["active", "suspended", "revoked"]),
});

adminRouter.patch("/users/:userId/gov-status", async (req: AuthRequest, res) => {
  const parsed = govSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.user.update({
    where: { id: req.params.userId },
    data: { govStatus: parsed.data.govStatus },
    select: { id: true, email: true, govStatus: true },
  });
  res.json(updated);
});

adminRouter.patch("/users/:userId/activate", async (req, res) => {
  const updated = await prisma.user.update({
    where: { id: req.params.userId },
    data: { isActive: true, govStatus: "active" },
    select: { id: true, email: true, isActive: true, govStatus: true },
  });
  res.json(updated);
});

adminRouter.patch("/users/:userId/deactivate", async (req, res) => {
  const updated = await prisma.user.update({
    where: { id: req.params.userId },
    data: { isActive: false, govStatus: "suspended" },
    select: { id: true, email: true, isActive: true, govStatus: true },
  });
  res.json(updated);
});

const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8).optional(),
});

adminRouter.patch("/users/:userId/reset-password", async (req: AuthRequest, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const temporaryPassword = parsed.data.temporaryPassword ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const updated = await prisma.user.update({
    where: { id: req.params.userId },
    data: { passwordHash, mustChangePassword: true },
    select: { id: true, email: true, mustChangePassword: true },
  });
  await writeAudit("ADMIN_PASSWORD_RESET", {
    actorUserId: req.userId,
    targetUserId: updated.id,
    req,
    metadata: { email: updated.email },
  });
  res.json({ user: updated, temporaryPassword });
});
