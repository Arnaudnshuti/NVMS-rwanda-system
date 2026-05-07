import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { volunteerEligibleToApply, eligibilityReason } from "../services/eligibility.service.js";
import { createNotification } from "../services/notification.service.js";
export const applicationsRouter = Router();
function serializeApplication(a) {
    return {
        id: a.id,
        volunteerId: a.volunteerId,
        volunteerEmail: a.volunteer.email,
        volunteerName: a.volunteer.name,
        volunteerDistrict: a.volunteer.district ?? undefined,
        programId: a.programId,
        status: a.status,
        submittedAt: a.submittedAt.toISOString(),
        coordinatorNote: a.coordinatorNote ?? undefined,
        reviewedAt: a.reviewedAt?.toISOString(),
    };
}
applicationsRouter.post("/", requireAuth, async (req, res) => {
    const schema = z.object({ programId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const volunteer = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!volunteer || volunteer.role !== "volunteer") {
        return res.status(403).json({ error: "Only volunteers may apply." });
    }
    if (!volunteerEligibleToApply(volunteer)) {
        return res.status(403).json({ error: eligibilityReason(volunteer) ?? "Not eligible to apply." });
    }
    const program = await prisma.program.findUnique({ where: { id: parsed.data.programId } });
    if (!program)
        return res.status(404).json({ error: "Program not found" });
    const blocking = await prisma.programApplication.findFirst({
        where: {
            volunteerId: volunteer.id,
            programId: program.id,
            status: { in: ["submitted", "under_review", "accepted", "waitlisted"] },
        },
    });
    if (blocking) {
        return res.status(409).json({ error: "You already have an active application for this program." });
    }
    const app = await prisma.programApplication.create({
        data: {
            volunteerId: volunteer.id,
            programId: program.id,
            status: "submitted",
        },
        include: { volunteer: { select: { email: true, name: true, district: true } } },
    });
    if (program.coordinatorUserId) {
        await createNotification({
            userId: program.coordinatorUserId,
            type: "INFO",
            title: "New volunteer application",
            message: `${volunteer.name} applied to ${program.title}.`,
            metadata: { programId: program.id, applicationId: app.id },
        });
    }
    else {
        const admins = await prisma.user.findMany({ where: { role: "admin", isActive: true }, select: { id: true } });
        await Promise.all(admins.map((a) => createNotification({
            userId: a.id,
            type: "INFO",
            title: "Ministry program application",
            message: `${volunteer.name} applied to ${program.title}.`,
            metadata: { programId: program.id, applicationId: app.id },
        })));
    }
    res.status(201).json(serializeApplication(app));
});
applicationsRouter.get("/", requireAuth, async (req, res) => {
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!me)
        return res.status(401).json({ error: "Unauthorized" });
    if (me.role === "volunteer") {
        const list = await prisma.programApplication.findMany({
            where: { volunteerId: me.id },
            orderBy: { submittedAt: "desc" },
            include: { volunteer: { select: { email: true, name: true, district: true } } },
        });
        return res.json(list.map(serializeApplication));
    }
    if (me.role === "admin") {
        const list = await prisma.programApplication.findMany({
            orderBy: { submittedAt: "desc" },
            include: { volunteer: { select: { email: true, name: true, district: true } } },
        });
        return res.json(list.map(serializeApplication));
    }
    // coordinator: only programs owned by this coordinator.
    const programs = await prisma.program.findMany({
        where: { coordinatorUserId: me.id },
        select: { id: true },
    });
    const ids = programs.map((p) => p.id);
    if (!ids.length)
        return res.json([]);
    const list = await prisma.programApplication.findMany({
        where: { programId: { in: ids } },
        orderBy: { submittedAt: "desc" },
        include: { volunteer: { select: { email: true, name: true, district: true } } },
    });
    return res.json(list.map(serializeApplication));
});
const patchSchema = z.object({
    status: z.enum(["submitted", "under_review", "accepted", "waitlisted", "rejected", "withdrawn"]),
    coordinatorNote: z.string().optional(),
});
applicationsRouter.patch("/:id", requireAuth, async (req, res) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const app = await prisma.programApplication.findUnique({
        where: { id: req.params.id },
        include: { program: true },
    });
    if (!app)
        return res.status(404).json({ error: "Not found" });
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!me)
        return res.status(401).json({ error: "Unauthorized" });
    if (me.role === "volunteer") {
        if (app.volunteerId !== me.id)
            return res.status(403).json({ error: "Forbidden" });
        if (parsed.data.status !== "withdrawn") {
            return res.status(403).json({ error: "Volunteers may only withdraw their own application." });
        }
    }
    else if (me.role === "coordinator") {
        // Ministry-owned programs must be reviewed by admin.
        if (!app.program.coordinatorUserId || app.program.coordinatorUserId !== me.id) {
            return res.status(403).json({ error: "Forbidden" });
        }
    }
    else if (me.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
    }
    const updated = await prisma.programApplication.update({
        where: { id: app.id },
        data: {
            status: parsed.data.status,
            coordinatorNote: parsed.data.coordinatorNote,
            reviewedAt: new Date(),
        },
        include: { volunteer: { select: { email: true, name: true, district: true } } },
    });
    if (me.role !== "volunteer") {
        await createNotification({
            userId: updated.volunteerId,
            type: parsed.data.status === "accepted" ? "SUCCESS" : parsed.data.status === "rejected" ? "WARNING" : "INFO",
            title: "Application status updated",
            message: `Your application status is now ${parsed.data.status.replace("_", " ")}.`,
            metadata: { applicationId: updated.id, status: parsed.data.status, programId: updated.programId },
        });
    }
    res.json(serializeApplication(updated));
});
