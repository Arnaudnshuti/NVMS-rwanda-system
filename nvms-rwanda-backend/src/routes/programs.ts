import { Router } from "express";
import { z } from "zod";
import type { ProgramStatus } from "@prisma/client";
import { prisma } from "../services/prisma.service.js";
import { requireAuth, requireRoles, type AuthRequest } from "../middlewares/auth.middleware.js";
import { notifyProgramCoordinators } from "../services/notification.service.js";

export const programsRouter = Router();

function serializeProgram(p: {
  id: string;
  title: string;
  description: string;
  category: string;
  district: string;
  sector: string | null;
  startDate: Date;
  endDate: Date;
  slotsTotal: number;
  slotsFilled: number;
  requiredSkills: string[];
  status: ProgramStatus;
  coordinatorDisplayName: string | null;
  _count?: { applications?: number; assignments?: number };
}) {
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
    slotsFilled: p._count?.applications ?? p._count?.assignments ?? p.slotsFilled,
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
      ...(status && status !== "draft" ? { status: status as ProgramStatus } : { status: { not: "draft" } }),
    },
    orderBy: { startDate: "asc" },
    include: { _count: { select: { applications: true, assignments: true } } },
  });

  res.json(programs.map(serializeProgram));
});

programsRouter.get("/admin/all", requireAuth, requireRoles("admin", "coordinator"), async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const programs = await prisma.program.findMany({
    where: me.role === "coordinator" && me.district ? { district: me.district } : undefined,
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
    include: { _count: { select: { applications: true, assignments: true } } },
  });

  res.json(programs.map(serializeProgram));
});

programsRouter.get("/:id", async (req, res) => {
  const p = await prisma.program.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { applications: true, assignments: true } } },
  });
  if (!p) return res.status(404).json({ error: "Program not found" });
  res.json(serializeProgram(p));
});

const upsertProgramSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  category: z.string().min(1),
  district: z.string().min(1).optional(),
  districtId: z.string().min(1).optional(),
  sector: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  slotsTotal: z.number().int().positive(),
  slotsFilled: z.number().int().min(0).optional(),
  requiredSkills: z.array(z.string()),
  status: z.enum(["open", "in_progress", "completed", "draft"]),
  coordinatorDisplayName: z.string().optional(),
});

programsRouter.post("/", requireAuth, requireRoles("admin", "coordinator"), async (req: AuthRequest, res) => {
  const parsed = upsertProgramSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  let districtName = parsed.data.district;
  let districtId = parsed.data.districtId;
  if (districtId) {
    const d = await prisma.district.findUnique({ where: { id: districtId } });
    if (!d || !d.isActive) return res.status(400).json({ error: "Invalid districtId" });
    districtName = d.name;
  }
  if (!districtName) return res.status(400).json({ error: "district or districtId is required" });
  if (me.role === "coordinator") {
    const sameDistrictId = Boolean(me.districtId && districtId && districtId === me.districtId);
    const sameDistrictName = Boolean(me.district && districtName === me.district);
    if (!sameDistrictId && !sameDistrictName) {
      return res.status(403).json({ error: "Coordinators may only create programs in their district." });
    }
    districtId = me.districtId ?? districtId;
    districtName = me.district ?? districtName;
  }

  const body = parsed.data;
  const program = await prisma.program.create({
    data: {
      title: body.title,
      description: body.description,
      category: body.category,
      district: districtName,
      districtId,
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
  if (me.role === "admin") {
    await notifyProgramCoordinators({
      district: program.district,
      type: program.status === "draft" ? "INFO" : "SUCCESS",
      title: program.status === "open" ? "New district program is open" : "New district program created",
      message: `${program.title} was created for ${program.district}.`,
      metadata: { programId: program.id, status: program.status },
    });
  }
  res.status(201).json(serializeProgram(program));
});

programsRouter.patch("/:id", requireAuth, requireRoles("admin", "coordinator"), async (req: AuthRequest, res) => {
  const partial = upsertProgramSchema.partial().safeParse(req.body);
  if (!partial.success) return res.status(400).json({ error: partial.error.flatten() });

  const existing = await prisma.program.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (me.role === "coordinator" && existing.district !== me.district) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const b = partial.data;
  let districtName = b.district;
  let districtId = b.districtId;
  if (districtId) {
    const d = await prisma.district.findUnique({ where: { id: districtId } });
    if (!d || !d.isActive) return res.status(400).json({ error: "Invalid districtId" });
    districtName = d.name;
  }
  if (me.role === "coordinator" && districtName && districtName !== me.district) {
    return res.status(403).json({ error: "Coordinators may only manage programs in their district." });
  }

  const program = await prisma.program.update({
    where: { id: req.params.id },
    data: {
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.description !== undefined ? { description: b.description } : {}),
      ...(b.category !== undefined ? { category: b.category } : {}),
      ...(districtName !== undefined ? { district: districtName } : {}),
      ...(districtId !== undefined ? { districtId } : {}),
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
  if (me.role === "admin") {
    const openedNow = existing.status !== "open" && program.status === "open";
    await notifyProgramCoordinators({
      coordinatorUserId: program.coordinatorUserId,
      district: program.district,
      type: openedNow ? "SUCCESS" : "INFO",
      title: openedNow ? "District program published" : "District program updated",
      message: openedNow
        ? `${program.title} is now open for volunteer applications in ${program.district}.`
        : `${program.title} was updated for ${program.district}.`,
      metadata: { programId: program.id, previousStatus: existing.status, status: program.status },
    });
  }
  res.json(serializeProgram(program));
});

programsRouter.delete("/:id", requireAuth, requireRoles("admin", "coordinator"), async (req: AuthRequest, res) => {
  const existing = await prisma.program.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (me.role === "coordinator" && existing.district !== me.district) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const logs = await prisma.activityLog.findMany({
    where: { programId: existing.id },
    select: { id: true },
  });
  const logIds = logs.map((l) => l.id);

  await prisma.$transaction([
    ...(logIds.length ? [prisma.activityAttachment.deleteMany({ where: { activityLogId: { in: logIds } } })] : []),
    prisma.activityLog.deleteMany({ where: { programId: existing.id } }),
    prisma.assignment.deleteMany({ where: { programId: existing.id } }),
    prisma.programApplication.deleteMany({ where: { programId: existing.id } }),
    prisma.program.delete({ where: { id: existing.id } }),
  ]);

  if (me.role === "admin") {
    await notifyProgramCoordinators({
      coordinatorUserId: existing.coordinatorUserId,
      district: existing.district,
      type: "WARNING",
      title: "District program removed",
      message: `${existing.title} was removed from ${existing.district}.`,
      metadata: { programId: existing.id, status: existing.status },
    });
  }

  res.json({ ok: true });
});
