import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { requireAuth, requireRoles, type AuthRequest } from "../middlewares/auth.middleware.js";
import { writeAudit } from "../services/audit.service.js";
import { sendTemplatedEmail } from "../services/email/mailer.js";

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
  } else {
    await writeAudit("COORDINATOR_VOLUNTEER_REJECTED", {
      actorUserId: req.userId,
      targetUserId: updated.id,
      req,
      metadata: { email: updated.email, district: updated.district },
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
