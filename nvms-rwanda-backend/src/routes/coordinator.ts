import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { requireAuth, requireRoles, type AuthRequest } from "../middlewares/auth.middleware.js";
import { writeAudit } from "../services/audit.service.js";
import { sendTemplatedEmail } from "../services/email/mailer.js";
import { createNotification } from "../services/notification.service.js";

export const coordinatorRouter = Router();

coordinatorRouter.use(requireAuth, requireRoles("admin", "coordinator"));

coordinatorRouter.get("/volunteers", async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = typeof req.query.verificationStatus === "string" ? req.query.verificationStatus : "";

  const districtWhere =
    me.role === "coordinator" && me.district ? { district: me.district } : {};

  const users = await prisma.user.findMany({
    where: {
      role: "volunteer",
      ...districtWhere,
      ...(status ? { verificationStatus: status as "pending" | "verified" | "rejected" } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      district: true,
      phone: true,
      verificationStatus: true,
      profileTrustStatus: true,
      createdAt: true,
    },
  });

  res.json(users);
});

const verifySchema = z.object({
  verificationStatus: z.enum(["verified", "rejected"]),
});

coordinatorRouter.patch("/volunteers/:userId/verification", async (req: AuthRequest, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target || target.role !== "volunteer") {
    return res.status(404).json({ error: "Volunteer not found" });
  }
  if (me.role === "coordinator") {
    if (!me.district || target.district !== me.district) {
      return res.status(403).json({ error: "You may only verify volunteers in your district." });
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      verificationStatus: parsed.data.verificationStatus,
      ...(parsed.data.verificationStatus === "verified" ? { isActive: true } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      district: true,
      verificationStatus: true,
      profileTrustStatus: true,
    },
  });

  const link = process.env.SYSTEM_LOGIN_LINK ?? "http://localhost:5173/login";
  if (parsed.data.verificationStatus === "verified") {
    await writeAudit("COORDINATOR_VOLUNTEER_APPROVED", {
      actorUserId: req.userId,
      targetUserId: updated.id,
      req,
      metadata: { email: updated.email, district: updated.district },
    });
    await sendTemplatedEmail({
      templateId: "volunteer_approved",
      to: updated.email,
      actorUserId: req.userId,
      targetUserId: updated.id,
      vars: {
        name: updated.name,
        email: updated.email,
        link,
        role: "volunteer",
      },
    });
    await createNotification({
      userId: updated.id,
      type: "SUCCESS",
      title: "Registration approved",
      message: "Your volunteer registration has been approved. You can now sign in.",
      metadata: { verificationStatus: "verified" },
    });
  } else {
    await writeAudit("COORDINATOR_VOLUNTEER_REJECTED", {
      actorUserId: req.userId,
      targetUserId: updated.id,
      req,
      metadata: { email: updated.email, district: updated.district },
    });
    await createNotification({
      userId: updated.id,
      type: "WARNING",
      title: "Registration not approved",
      message: "Your volunteer registration was not approved. Contact your district coordinator.",
      metadata: { verificationStatus: "rejected" },
    });
  }

  res.json(updated);
});

const trustSchema = z.object({
  profileTrustStatus: z.enum(["verified", "rejected", "unsubmitted"]),
});

coordinatorRouter.patch("/volunteers/:userId/trust", async (req: AuthRequest, res) => {
  const parsed = trustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target || target.role !== "volunteer") {
    return res.status(404).json({ error: "Volunteer not found" });
  }
  if (me.role === "coordinator") {
    if (!me.district || target.district !== me.district) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { profileTrustStatus: parsed.data.profileTrustStatus },
    select: {
      id: true,
      name: true,
      email: true,
      district: true,
      verificationStatus: true,
      profileTrustStatus: true,
    },
  });

  res.json(updated);
});

coordinatorRouter.get("/deployments", async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  const where =
    me.role === "coordinator"
      ? { program: { coordinatorUserId: me.id } }
      : undefined;
  const list = await prisma.assignment.findMany({
    where,
    orderBy: { startDate: "desc" },
    include: {
      volunteer: { select: { id: true, name: true, email: true, district: true } },
      program: { select: { id: true, title: true, district: true } },
    },
  });
  res.json(
    list.map((a) => ({
      id: a.id,
      volunteerId: a.volunteerId,
      volunteerName: a.volunteer.name,
      volunteerEmail: a.volunteer.email,
      volunteerDistrict: a.volunteer.district,
      programId: a.programId,
      programTitle: a.programTitle,
      district: a.district,
      startDate: a.startDate.toISOString().slice(0, 10),
      endDate: a.endDate.toISOString().slice(0, 10),
      status: a.status,
      hoursLogged: a.hoursLogged,
      strikes: a.strikes,
    })),
  );
});

const assignSchema = z.object({
  programId: z.string().min(1),
  volunteerId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

coordinatorRouter.post("/deployments/assign", async (req: AuthRequest, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  const program = await prisma.program.findUnique({ where: { id: parsed.data.programId } });
  if (!program) return res.status(404).json({ error: "Program not found" });
  if (me.role === "coordinator" && program.coordinatorUserId !== me.id) {
    return res.status(403).json({ error: "You can only assign for your own programs." });
  }
  const volunteer = await prisma.user.findUnique({ where: { id: parsed.data.volunteerId } });
  if (!volunteer || volunteer.role !== "volunteer") return res.status(404).json({ error: "Volunteer not found" });
  if (volunteer.profileTrustStatus !== "verified" || volunteer.verificationStatus !== "verified") {
    return res.status(400).json({ error: "Volunteer must be verified and trusted before assignment." });
  }
  const exists = await prisma.assignment.findFirst({
    where: { programId: program.id, volunteerId: volunteer.id, status: { in: ["active", "upcoming"] } },
  });
  if (exists) return res.status(409).json({ error: "Volunteer already assigned to this program." });

  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : program.startDate;
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : program.endDate;
  const assignment = await prisma.assignment.create({
    data: {
      volunteerId: volunteer.id,
      programId: program.id,
      programTitle: program.title,
      district: program.district,
      startDate,
      endDate,
      status: startDate > new Date() ? "upcoming" : "active",
    },
  });
  await createNotification({
    userId: volunteer.id,
    type: "INFO",
    title: "Program assignment",
    message: `You were assigned to ${program.title}.`,
    metadata: { assignmentId: assignment.id, programId: program.id },
  });
  res.status(201).json({ id: assignment.id, message: "Volunteer assigned" });
});
