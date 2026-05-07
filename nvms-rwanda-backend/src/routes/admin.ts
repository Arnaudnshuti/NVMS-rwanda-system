import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { requireAuth, requireRoles, type AuthRequest } from "../middlewares/auth.middleware.js";
import { hashPassword } from "../services/auth.service.js";
import { writeAudit } from "../services/audit.service.js";
import { sendTemplatedEmail } from "../services/email/mailer.js";
import { createNotification } from "../services/notification.service.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun } from "docx";

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
  await createNotification({
    userId: created.id,
    type: "INFO",
    title: "You were invited as coordinator",
    message: "Use temporary credentials from your invitation email and change password within 24 hours.",
    metadata: { district: created.district },
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
    organizationName: row.organizationName ?? "Ministry of Local Government — Rwanda",
    contactEmail: row.contactEmail ?? "volunteer@minaloc.gov.rw",
    supportPhone: row.supportPhone ?? "+250 788 000 000",
  });
});

const platformSchema = z.object({
  volunteerCategories: z.array(z.string()),
  programTypes: z.array(z.string()),
  organizationName: z.string().optional(),
  contactEmail: z.string().optional(),
  supportPhone: z.string().optional(),
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
      organizationName: parsed.data.organizationName,
      contactEmail: parsed.data.contactEmail,
      supportPhone: parsed.data.supportPhone,
    },
    update: {
      volunteerCategories: parsed.data.volunteerCategories.filter(Boolean),
      programTypes: parsed.data.programTypes.filter(Boolean),
      organizationName: parsed.data.organizationName,
      contactEmail: parsed.data.contactEmail,
      supportPhone: parsed.data.supportPhone,
    },
  });

  res.json({
    volunteerCategories: row.volunteerCategories as string[],
    programTypes: row.programTypes as string[],
    organizationName: row.organizationName ?? undefined,
    contactEmail: row.contactEmail ?? undefined,
    supportPhone: row.supportPhone ?? undefined,
  });
});

adminRouter.patch("/users/:userId/resend-invite", async (req: AuthRequest, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target || target.role !== "coordinator") return res.status(404).json({ error: "Coordinator not found" });
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash, mustChangePassword: true, isActive: true, govStatus: "active" },
  });
  const link = process.env.SYSTEM_LOGIN_LINK ?? "http://localhost:5173/login";
  await sendTemplatedEmail({
    templateId: "coordinator_invite",
    to: target.email,
    actorUserId: req.userId,
    targetUserId: target.id,
    vars: {
      name: target.name,
      email: target.email,
      password: temporaryPassword,
      link,
      role: "coordinator",
      district: target.district ?? "",
    },
  });
  await createNotification({
    userId: target.id,
    type: "INFO",
    title: "Invitation re-sent",
    message: "Admin re-sent temporary credentials. Please sign in and change password immediately.",
    metadata: { resentBy: req.userId },
  });
  res.json({ ok: true, temporaryPassword });
});

adminRouter.get("/reports/summary", async (_req, res) => {
  const [totalUsers, volunteers, coordinators, admins, pendingVolunteers, programs, activePrograms, apps, logs] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "volunteer" } }),
      prisma.user.count({ where: { role: "coordinator" } }),
      prisma.user.count({ where: { role: "admin" } }),
      prisma.user.count({ where: { role: "volunteer", verificationStatus: "pending" } }),
      prisma.program.count(),
      prisma.program.count({ where: { status: { in: ["open", "in_progress"] } } }),
      prisma.programApplication.count(),
      prisma.activityLog.count(),
    ]);
  const byDistrict = await prisma.user.groupBy({
    by: ["district"],
    where: { role: "volunteer" },
    _count: { _all: true },
  });
  res.json({
    generatedAt: new Date().toISOString(),
    metrics: { totalUsers, volunteers, coordinators, admins, pendingVolunteers, programs, activePrograms, applications: apps, activityLogs: logs },
    byDistrict: byDistrict.map((d) => ({ district: d.district ?? "Unassigned", volunteers: d._count._all })),
  });
});

adminRouter.get("/reports/export", async (req, res) => {
  const format = String(req.query.format ?? "csv").toLowerCase();
  const data = await prisma.programApplication.findMany({
    orderBy: { submittedAt: "desc" },
    include: { volunteer: { select: { name: true, email: true, district: true } }, program: { select: { title: true, district: true } } },
    take: 5000,
  });
  const rows = data.map((r) => ({
    applicationId: r.id,
    submittedAt: r.submittedAt.toISOString(),
    status: r.status,
    volunteerName: r.volunteer.name,
    volunteerEmail: r.volunteer.email,
    volunteerDistrict: r.volunteer.district ?? "",
    programTitle: r.program.title,
    programDistrict: r.program.district,
  }));

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Applications");
    ws.columns = Object.keys(rows[0] ?? { applicationId: "" }).map((k) => ({ header: k, key: k }));
    rows.forEach((r) => ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="nvms-report.xlsx"');
    return res.send(Buffer.from(buf));
  }
  if (format === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="nvms-report.pdf"');
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(16).text("NVMS Applications Report");
    doc.moveDown();
    rows.slice(0, 200).forEach((r) => {
      doc.fontSize(10).text(`${r.submittedAt} | ${r.status} | ${r.volunteerName} | ${r.programTitle}`);
    });
    doc.end();
    return;
  }
  if (format === "docx") {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: "NVMS Applications Report", bold: true, size: 32 })] }),
            ...rows.slice(0, 300).map((r) => new Paragraph(`${r.submittedAt} | ${r.status} | ${r.volunteerName} | ${r.programTitle}`)),
          ],
        },
      ],
    });
    const buf = await Packer.toBuffer(doc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", 'attachment; filename="nvms-report.docx"');
    return res.send(buf);
  }
  // default csv (excel-compatible)
  const header = Object.keys(rows[0] ?? {});
  const csv = [header.join(","), ...rows.map((r) => header.map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? "")).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="nvms-report.csv"');
  return res.send(csv);
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
