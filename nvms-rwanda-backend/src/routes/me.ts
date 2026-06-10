import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { requireAuth, type AuthRequest } from "../middlewares/auth.middleware.js";
import { serializeUserWithDocs } from "../services/user.service.js";
import multer from "multer";
import PDFDocument from "pdfkit";
import { ensureUploadsDir, makeSafeFileName, publicUploadUrl, uploadsDir } from "../services/uploads.service.js";
import { createNotification, notifyDistrictCoordinators } from "../services/notification.service.js";
import { validateRwandaNationalId, validateRwandaPhone } from "../utils/validation.js";

export const meRouter = Router();

meRouter.use(requireAuth);

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await ensureUploadsDir();
        cb(null, uploadsDir());
      } catch (e) {
        cb(e as Error, uploadsDir());
      }
    },
    filename: (_req, file, cb) => cb(null, makeSafeFileName(file.originalname)),
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

meRouter.post("/avatar", upload.single("file"), async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!req.file) return res.status(400).json({ error: "Missing file" });

  const storageKey = req.file.filename;
  const avatarUrl = publicUploadUrl(storageKey);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl },
  });

  res.json({ avatarUrl: updated.avatarUrl });
});

meRouter.post("/identity-documents", upload.single("file"), async (req: AuthRequest, res) => {
  const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
  if (!label) return res.status(400).json({ error: "Missing label" });

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!req.file) return res.status(400).json({ error: "Missing file" });

  const storageKey = req.file.filename;
  const fileName = req.file.originalname;
  const contentType = req.file.mimetype;

  const doc = await prisma.identityDocument.create({
    data: {
      userId: user.id,
      label,
      fileName,
      storageKey,
      contentType,
    },
    select: { id: true, label: true, fileName: true, storageKey: true, contentType: true, createdAt: true },
  });

  res.status(201).json({
    ...doc,
    url: doc.storageKey ? publicUploadUrl(doc.storageKey) : null,
  });
});

meRouter.get("/identity-documents", async (req: AuthRequest, res) => {
  const list = await prisma.identityDocument.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "asc" },
    select: { id: true, label: true, fileName: true, storageKey: true, contentType: true, createdAt: true },
  });
  res.json(
    list.map((d) => ({
      ...d,
      url: d.storageKey ? publicUploadUrl(d.storageKey) : null,
    })),
  );
});

const profilePatchSchema = z.object({
  name: z.string().min(1).optional(),
  volunteerAvailability: z.string().optional(),
  profession: z.string().optional(),
  educationLevel: z.string().optional(),
  nationalId: z.string().optional(),
  trustSkillsSummary: z.string().optional(),
  phone: z.string().optional(),
  district: z.string().optional(),
});

meRouter.patch("/profile", async (req: AuthRequest, res) => {
  const parsed = profilePatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const b = parsed.data;
  const nationalIdCheck = user.role === "volunteer" && b.nationalId ? validateRwandaNationalId(b.nationalId, user.dateOfBirth) : null;
  if (nationalIdCheck && !nationalIdCheck.ok) return res.status(400).json({ error: nationalIdCheck.error });
  const phoneCheck = b.phone ? validateRwandaPhone(b.phone) : null;
  if (phoneCheck && !phoneCheck.ok) return res.status(400).json({ error: phoneCheck.error });
  const skillsFromSummary =
    user.role === "volunteer"
      ? (b.trustSkillsSummary
          ?.split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean) ?? undefined)
      : undefined;
  const district =
    user.role === "volunteer" && b.district !== undefined
      ? await prisma.district.findFirst({
          where: { name: b.district.trim(), isActive: true },
          select: { id: true, name: true },
        })
      : null;
  if (user.role === "volunteer" && b.district !== undefined && !district) {
    return res.status(400).json({ error: "Select a valid active district." });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(b.name !== undefined ? { name: b.name.trim() } : {}),
      ...(user.role === "volunteer" && b.volunteerAvailability !== undefined ? { volunteerAvailability: b.volunteerAvailability } : {}),
      ...(user.role === "volunteer" && b.profession !== undefined ? { profession: b.profession } : {}),
      ...(user.role === "volunteer" && b.educationLevel !== undefined ? { educationLevel: b.educationLevel } : {}),
      ...(user.role === "volunteer" && b.nationalId !== undefined ? { nationalId: nationalIdCheck?.value ?? "" } : {}),
      ...(user.role === "volunteer" && b.trustSkillsSummary !== undefined ? { trustSkillsSummary: b.trustSkillsSummary } : {}),
      ...(district ? { district: district.name, districtId: district.id } : {}),
      ...(skillsFromSummary !== undefined ? { skills: skillsFromSummary } : {}),
      ...(b.phone !== undefined ? { phone: phoneCheck?.value ?? "" } : {}),
    },
  });

  res.json(await serializeUserWithDocs(updated));
});

const trustSchema = z.object({
  nationalId: z.string().min(1),
  emergencyContactName: z.string().min(1),
  emergencyContactPhone: z.string().min(1),
  trustSkillsSummary: z.string().min(1),
  profession: z.string().min(1),
  educationLevel: z.string().min(1),
  identityDocuments: z.array(z.object({ id: z.string().optional(), label: z.string(), fileName: z.string() })),
});

meRouter.post("/trust-submit", async (req: AuthRequest, res) => {
  const parsed = trustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user || user.role !== "volunteer") {
    return res.status(403).json({ error: "Only volunteers may submit trust documents." });
  }
  if (user.verificationStatus !== "verified") {
    return res.status(403).json({ error: "Account must be approved before KYC submission." });
  }
  if (user.profileTrustStatus === "verified") {
    return res.status(400).json({ error: "Trust profile already submitted or verified." });
  }
  if (user.profileTrustStatus === "pending_review") {
    const existingDocs = await prisma.identityDocument.findMany({
      where: { userId: user.id },
      select: { storageKey: true },
    });
    if (existingDocs.some((d) => d.storageKey)) {
      return res.status(400).json({ error: "Trust profile already submitted or verified." });
    }
  }
  const nationalIdCheck = validateRwandaNationalId(parsed.data.nationalId, user.dateOfBirth);
  if (!nationalIdCheck.ok) return res.status(400).json({ error: nationalIdCheck.error });
  const phoneCheck = validateRwandaPhone(parsed.data.emergencyContactPhone);
  if (!phoneCheck.ok) return res.status(400).json({ error: phoneCheck.error });

  const skills = parsed.data.trustSkillsSummary
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const uploadedDocumentIds = parsed.data.identityDocuments
    .map((d) => d.id)
    .filter((id): id is string => Boolean(id));
  const metadataOnlyDocuments = parsed.data.identityDocuments.filter((d) => !d.id);

  if (uploadedDocumentIds.length) {
    const ownedUploads = await prisma.identityDocument.count({
      where: { userId: user.id, id: { in: uploadedDocumentIds } },
    });
    if (ownedUploads !== uploadedDocumentIds.length) {
      return res.status(400).json({ error: "One or more uploaded documents could not be found." });
    }
  }

  await prisma.$transaction([
    prisma.identityDocument.deleteMany({
      where: {
        userId: user.id,
        ...(uploadedDocumentIds.length ? { id: { notIn: uploadedDocumentIds } } : {}),
      },
    }),
    ...(metadataOnlyDocuments.length
      ? [
          prisma.identityDocument.createMany({
            data: metadataOnlyDocuments.map((d) => ({
              userId: user.id,
              label: d.label,
              fileName: d.fileName,
            })),
          }),
        ]
      : []),
    prisma.user.update({
      where: { id: user.id },
      data: {
        nationalId: nationalIdCheck.value,
        emergencyContactName: parsed.data.emergencyContactName,
        emergencyContactPhone: phoneCheck.value,
        trustSkillsSummary: parsed.data.trustSkillsSummary,
        profession: parsed.data.profession,
        educationLevel: parsed.data.educationLevel,
        skills,
        profileTrustStatus: "pending_review",
      },
    }),
  ]);

  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  await notifyDistrictCoordinators({
    district: user.district,
    type: "INFO",
    title: "Trusted profile review pending",
    message: `${user.name} submitted identity and trust documents for review.`,
    metadata: { volunteerId: user.id, profileTrustStatus: "pending_review" },
  });
  res.json(await serializeUserWithDocs(fresh!));
});

meRouter.get("/assignments", async (req: AuthRequest, res) => {
  const list = await prisma.assignment.findMany({
    where: { volunteerId: req.userId! },
    orderBy: { startDate: "desc" },
  });
  res.json(
    list.map((a) => ({
      id: a.id,
      volunteerId: a.volunteerId,
      programId: a.programId,
      programTitle: a.programTitle,
      district: a.district,
      startDate: a.startDate.toISOString().slice(0, 10),
      endDate: a.endDate.toISOString().slice(0, 10),
      status: a.status,
      hoursLogged: a.hoursLogged,
    })),
  );
});

async function buildMyCertificates(userId: string) {
  const assignments = await prisma.assignment.findMany({
    where: { volunteerId: userId },
    orderBy: { endDate: "desc" },
    include: {
      volunteer: { select: { name: true, email: true, district: true, govStatus: true } },
      program: {
        select: {
          title: true,
          district: true,
          status: true,
          activityLogs: {
            where: { volunteerId: userId, status: "approved" },
            select: { date: true, hours: true },
            orderBy: { date: "desc" },
          },
        },
      },
    },
  });

  const certificates = assignments
    .map((a) => {
      const approvedHours = a.program.activityLogs.reduce((sum, l) => sum + Number(l.hours), 0);
      const latestApprovedLog = a.program.activityLogs[0]?.date;
      return {
        id: a.id,
        assignmentId: a.id,
        volunteerName: a.volunteer.name,
        volunteerEmail: a.volunteer.email,
        volunteerDistrict: a.volunteer.district ?? a.district,
        programId: a.programId,
        programTitle: a.programTitle,
        programDistrict: a.program.district,
        hoursServed: Math.round(approvedHours),
        startDate: a.startDate.toISOString().slice(0, 10),
        endDate: a.endDate.toISOString().slice(0, 10),
        issuedAt: (latestApprovedLog ?? a.endDate).toISOString().slice(0, 10),
        signedBy: a.program.district ? `${a.program.district} District / MINALOC` : "Ministry of Local Government",
        status: approvedHours > 0 ? "issued" : "not_eligible",
        reason:
          approvedHours > 0
            ? "Approved field report hours are recorded for this assignment."
            : "No approved field report hours recorded yet.",
      };
    });

  const issued = certificates.filter((c) => c.status === "issued");
  const volunteer = assignments[0]?.volunteer ?? (await prisma.user.findUnique({ where: { id: userId }, select: { govStatus: true } }));
  return {
    generatedAt: new Date().toISOString(),
    policy: {
      ministryCertificateThreshold: 3,
      requiresApprovedReports: true,
      requiresNoActiveSanctions: true,
    },
    eligibleForMinistryCertificate: issued.length >= 3 && volunteer?.govStatus === "active",
    completedEligibleCount: issued.length,
    certificates,
  };
}

meRouter.get("/certificates", async (req: AuthRequest, res) => {
  res.json(await buildMyCertificates(req.userId!));
});

meRouter.get("/certificates/:assignmentId/pdf", async (req: AuthRequest, res) => {
  const report = await buildMyCertificates(req.userId!);
  const cert = report.certificates.find((c) => c.assignmentId === req.params.assignmentId);
  if (!cert) return res.status(404).json({ error: "Certificate not found" });
  if (cert.status !== "issued") return res.status(400).json({ error: cert.reason });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="nvms-certificate-${cert.assignmentId}.pdf"`);

  const doc = new PDFDocument({ margin: 56, size: "A4" });
  doc.pipe(res);
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f8fafc");
  doc.roundedRect(42, 42, doc.page.width - 84, doc.page.height - 84, 12).fillAndStroke("#ffffff", "#0f766e");
  doc.fillColor("#0f766e").font("Helvetica-Bold").fontSize(18).text("NVMS Rwanda", 56, 78, { align: "center", width });
  doc.fillColor("#111827").fontSize(28).text("Certificate of Service", 56, 135, { align: "center", width });
  doc.moveDown(1.5);
  doc.font("Helvetica").fontSize(12).fillColor("#475569").text("This certificate is awarded to", { align: "center", width });
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#111827").text(cert.volunteerName, { align: "center", width });
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(12).fillColor("#475569").text("for verified volunteer service on", { align: "center", width });
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text(cert.programTitle, { align: "center", width });
  doc.moveDown(1.2);
  doc.font("Helvetica").fontSize(11).fillColor("#334155").text(
    `${cert.hoursServed} approved hour(s), served in ${cert.programDistrict} from ${cert.startDate} to ${cert.endDate}.`,
    { align: "center", width },
  );
  doc.moveDown(2);
  doc.fontSize(10).fillColor("#64748b").text(`Issued: ${cert.issuedAt}`, { align: "center", width });
  doc.text(`Signed by: ${cert.signedBy}`, { align: "center", width });
  doc.text(`Verification ID: ${cert.assignmentId}`, { align: "center", width });
  doc.fontSize(8).fillColor("#64748b").text("Generated from NVMS live assignment and approved activity report records.", 56, 760, {
    align: "center",
    width,
  });
  doc.end();
});

meRouter.get("/activity-logs", async (req: AuthRequest, res) => {
  const list = await prisma.activityLog.findMany({
    where: { volunteerId: req.userId! },
    orderBy: { date: "desc" },
    take: 100,
    include: {
      program: { select: { title: true, district: true } },
      attachments: {
        select: { id: true, fileName: true, storageKey: true, contentType: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  res.json(
    list.map((l) => ({
      id: l.id,
      volunteerId: l.volunteerId,
      programId: l.programId,
      programTitle: l.program.title,
      programDistrict: l.program.district,
      date: l.date.toISOString().slice(0, 10),
      hours: Number(l.hours),
      description: l.description,
      status: l.status,
      attachments: l.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        contentType: a.contentType ?? undefined,
        url: publicUploadUrl(a.storageKey),
      })),
    })),
  );
});

meRouter.post("/activity-logs", upload.array("files", 8), async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      programId: z.string().min(1),
      date: z.string().min(1),
      hours: z.coerce.number().positive(),
      description: z.string().min(1),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const assignment = await prisma.assignment.findFirst({
    where: { volunteerId: req.userId!, programId: parsed.data.programId },
  });
  if (!assignment) return res.status(403).json({ error: "You can only report for your assigned programs." });

  const created = await prisma.activityLog.create({
    data: {
      volunteerId: req.userId!,
      programId: parsed.data.programId,
      date: new Date(parsed.data.date),
      hours: parsed.data.hours,
      description: parsed.data.description,
      status: "pending",
    },
  });

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length) {
    await prisma.activityAttachment.createMany({
      data: files.map((f) => ({
        activityLogId: created.id,
        fileName: f.originalname,
        storageKey: f.filename,
        contentType: f.mimetype,
      })),
    });
  }

  await createNotification({
    userId: req.userId!,
    type: "SUCCESS",
    title: "Activity submitted",
    message: "Your activity report was submitted and is awaiting review.",
    metadata: { activityLogId: created.id, programId: created.programId },
  });

  const program = await prisma.program.findUnique({
    where: { id: created.programId },
    select: { title: true, district: true, coordinatorUserId: true },
  });
  if (program?.coordinatorUserId) {
    await createNotification({
      userId: program.coordinatorUserId,
      type: "INFO",
      title: "Activity report pending review",
      message: `A volunteer submitted an activity report for ${program.title}.`,
      metadata: { activityLogId: created.id, programId: created.programId },
    });
  } else {
    await notifyDistrictCoordinators({
      district: program?.district,
      type: "INFO",
      title: "Activity report pending review",
      message: `A volunteer submitted an activity report for ${program?.title ?? "a district program"}.`,
      metadata: { activityLogId: created.id, programId: created.programId },
    });
  }

  return res.status(201).json({ id: created.id, message: "Activity submitted" });
});

meRouter.get("/notifications", async (req: AuthRequest, res) => {
  const list = await prisma.notification.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(
    list.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      readAt: n.readAt?.toISOString(),
      createdAt: n.createdAt.toISOString(),
      metadata: n.metadata,
    })),
  );
});

meRouter.patch("/notifications/:id/read", async (req: AuthRequest, res) => {
  const updated = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.userId! },
    data: { readAt: new Date() },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Notification not found" });
  res.json({ ok: true });
});

meRouter.patch("/notifications/read-all", async (req: AuthRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId!, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});
