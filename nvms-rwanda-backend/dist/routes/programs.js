import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";
export const programsRouter = Router();
function serializeProgram(p) {
    return {
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        district: p.district,
        sector: p.sector ?? undefined,
        startDate: p.startDate.toISOString().slice(0, 10),
        endDate: p.endDate.toISOString().slice(0, 10),
        slotsTotal: p.slotsTotal,
        slotsFilled: p.slotsFilled,
        requiredSkills: p.requiredSkills,
        status: p.status,
        coordinator: p.coordinatorDisplayName ?? "",
    };
}
programsRouter.get("/", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const district = typeof req.query.district === "string" ? req.query.district : "";
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const programs = await prisma.program.findMany({
        where: {
            ...(q
                ? {
                    OR: [
                        { title: { contains: q, mode: "insensitive" } },
                        { description: { contains: q, mode: "insensitive" } },
                    ],
                }
                : {}),
            ...(district && district !== "all" ? { district } : {}),
            ...(category && category !== "all" ? { category } : {}),
            ...(status ? { status: status } : {}),
        },
        orderBy: { startDate: "asc" },
    });
    res.json(programs.map(serializeProgram));
});
programsRouter.get("/:id", async (req, res) => {
    const p = await prisma.program.findUnique({ where: { id: req.params.id } });
    if (!p)
        return res.status(404).json({ error: "Program not found" });
    res.json(serializeProgram(p));
});
const upsertProgramSchema = z.object({
    title: z.string().min(1),
    description: z.string(),
    category: z.string().min(1),
    district: z.string().min(1),
    sector: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
    slotsTotal: z.number().int().positive(),
    slotsFilled: z.number().int().min(0).optional(),
    requiredSkills: z.array(z.string()),
    status: z.enum(["open", "in_progress", "completed", "draft"]),
    coordinatorDisplayName: z.string().optional(),
});
programsRouter.post("/", requireAuth, requireRoles("admin", "coordinator"), async (req, res) => {
    const parsed = upsertProgramSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!me)
        return res.status(401).json({ error: "Unauthorized" });
    if (me.role === "coordinator") {
        if (!me.district || parsed.data.district !== me.district) {
            return res.status(403).json({ error: "Coordinators may only create programs in their district." });
        }
    }
    const body = parsed.data;
    const program = await prisma.program.create({
        data: {
            title: body.title,
            description: body.description,
            category: body.category,
            district: body.district,
            sector: body.sector,
            startDate: new Date(body.startDate),
            endDate: new Date(body.endDate),
            slotsTotal: body.slotsTotal,
            slotsFilled: body.slotsFilled ?? 0,
            requiredSkills: body.requiredSkills,
            status: body.status,
            coordinatorDisplayName: body.coordinatorDisplayName ?? me.name,
            coordinatorUserId: me.role === "coordinator" ? me.id : undefined,
        },
    });
    res.status(201).json(serializeProgram(program));
});
programsRouter.patch("/:id", requireAuth, requireRoles("admin", "coordinator"), async (req, res) => {
    const partial = upsertProgramSchema.partial().safeParse(req.body);
    if (!partial.success)
        return res.status(400).json({ error: partial.error.flatten() });
    const existing = await prisma.program.findUnique({ where: { id: req.params.id } });
    if (!existing)
        return res.status(404).json({ error: "Not found" });
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!me)
        return res.status(401).json({ error: "Unauthorized" });
    if (me.role === "coordinator" && existing.district !== me.district) {
        return res.status(403).json({ error: "Forbidden" });
    }
    const b = partial.data;
    const program = await prisma.program.update({
        where: { id: req.params.id },
        data: {
            ...(b.title !== undefined ? { title: b.title } : {}),
            ...(b.description !== undefined ? { description: b.description } : {}),
            ...(b.category !== undefined ? { category: b.category } : {}),
            ...(b.district !== undefined ? { district: b.district } : {}),
            ...(b.sector !== undefined ? { sector: b.sector } : {}),
            ...(b.startDate !== undefined ? { startDate: new Date(b.startDate) } : {}),
            ...(b.endDate !== undefined ? { endDate: new Date(b.endDate) } : {}),
            ...(b.slotsTotal !== undefined ? { slotsTotal: b.slotsTotal } : {}),
            ...(b.slotsFilled !== undefined ? { slotsFilled: b.slotsFilled } : {}),
            ...(b.requiredSkills !== undefined ? { requiredSkills: b.requiredSkills } : {}),
            ...(b.status !== undefined ? { status: b.status } : {}),
            ...(b.coordinatorDisplayName !== undefined ? { coordinatorDisplayName: b.coordinatorDisplayName } : {}),
        },
    });
    res.json(serializeProgram(program));
});
