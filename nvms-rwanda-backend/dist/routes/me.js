import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { serializeUserWithDocs } from "../services/user.service.js";
import multer from "multer";
import { ensureUploadsDir, makeSafeFileName, publicUploadUrl, uploadsDir } from "../services/uploads.service.js";
export const meRouter = Router();
meRouter.use(requireAuth);
const upload = multer({
    storage: multer.diskStorage({
        destination: async (_req, _file, cb) => {
            try {
                await ensureUploadsDir();
                cb(null, uploadsDir());
            }
            catch (e) {
                cb(e, uploadsDir());
            }
        },
        filename: (_req, file, cb) => cb(null, makeSafeFileName(file.originalname)),
    }),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});
meRouter.post("/avatar", upload.single("file"), async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user)
        return res.status(401).json({ error: "Unauthorized" });
    if (!req.file)
        return res.status(400).json({ error: "Missing file" });
    const storageKey = req.file.filename;
    const avatarUrl = publicUploadUrl(storageKey);
    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl },
    });
    res.json({ avatarUrl: updated.avatarUrl });
});
meRouter.post("/identity-documents", upload.single("file"), async (req, res) => {
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    if (!label)
        return res.status(400).json({ error: "Missing label" });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user)
        return res.status(401).json({ error: "Unauthorized" });
    if (!req.file)
        return res.status(400).json({ error: "Missing file" });
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
meRouter.get("/identity-documents", async (req, res) => {
    const list = await prisma.identityDocument.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, label: true, fileName: true, storageKey: true, contentType: true, createdAt: true },
    });
    res.json(list.map((d) => ({
        ...d,
        url: d.storageKey ? publicUploadUrl(d.storageKey) : null,
    })));
});
const profilePatchSchema = z.object({
    volunteerAvailability: z.string().optional(),
    profession: z.string().optional(),
    educationLevel: z.string().optional(),
    nationalId: z.string().optional(),
    trustSkillsSummary: z.string().optional(),
    phone: z.string().optional(),
});
meRouter.patch("/profile", async (req, res) => {
    const parsed = profilePatchSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.role !== "volunteer") {
        return res.status(403).json({ error: "Only volunteers may update this profile." });
    }
    const b = parsed.data;
    const skillsFromSummary = b.trustSkillsSummary
        ?.split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean) ?? undefined;
    const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
            ...(b.volunteerAvailability !== undefined ? { volunteerAvailability: b.volunteerAvailability } : {}),
            ...(b.profession !== undefined ? { profession: b.profession } : {}),
            ...(b.educationLevel !== undefined ? { educationLevel: b.educationLevel } : {}),
            ...(b.nationalId !== undefined ? { nationalId: b.nationalId } : {}),
            ...(b.trustSkillsSummary !== undefined ? { trustSkillsSummary: b.trustSkillsSummary } : {}),
            ...(skillsFromSummary !== undefined ? { skills: skillsFromSummary } : {}),
            ...(b.phone !== undefined ? { phone: b.phone } : {}),
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
    identityDocuments: z.array(z.object({ label: z.string(), fileName: z.string() })),
});
meRouter.post("/trust-submit", async (req, res) => {
    const parsed = trustSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.role !== "volunteer") {
        return res.status(403).json({ error: "Only volunteers may submit trust documents." });
    }
    if (user.verificationStatus !== "verified") {
        return res.status(403).json({ error: "Account must be approved before KYC submission." });
    }
    if (user.profileTrustStatus === "pending_review" || user.profileTrustStatus === "verified") {
        return res.status(400).json({ error: "Trust profile already submitted or verified." });
    }
    const skills = parsed.data.trustSkillsSummary
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    await prisma.$transaction([
        prisma.identityDocument.deleteMany({ where: { userId: user.id } }),
        prisma.identityDocument.createMany({
            data: parsed.data.identityDocuments.map((d) => ({
                userId: user.id,
                label: d.label,
                fileName: d.fileName,
            })),
        }),
        prisma.user.update({
            where: { id: user.id },
            data: {
                nationalId: parsed.data.nationalId,
                emergencyContactName: parsed.data.emergencyContactName,
                emergencyContactPhone: parsed.data.emergencyContactPhone,
                trustSkillsSummary: parsed.data.trustSkillsSummary,
                profession: parsed.data.profession,
                educationLevel: parsed.data.educationLevel,
                skills,
                profileTrustStatus: "pending_review",
            },
        }),
    ]);
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    res.json(await serializeUserWithDocs(fresh));
});
meRouter.get("/assignments", async (req, res) => {
    const list = await prisma.assignment.findMany({
        where: { volunteerId: req.userId },
        orderBy: { startDate: "desc" },
    });
    res.json(list.map((a) => ({
        id: a.id,
        volunteerId: a.volunteerId,
        programId: a.programId,
        programTitle: a.programTitle,
        district: a.district,
        startDate: a.startDate.toISOString().slice(0, 10),
        endDate: a.endDate.toISOString().slice(0, 10),
        status: a.status,
        hoursLogged: a.hoursLogged,
    })));
});
meRouter.get("/activity-logs", async (req, res) => {
    const list = await prisma.activityLog.findMany({
        where: { volunteerId: req.userId },
        orderBy: { date: "desc" },
        take: 100,
    });
    res.json(list.map((l) => ({
        id: l.id,
        volunteerId: l.volunteerId,
        programId: l.programId,
        date: l.date.toISOString().slice(0, 10),
        hours: Number(l.hours),
        description: l.description,
        status: l.status,
    })));
});
