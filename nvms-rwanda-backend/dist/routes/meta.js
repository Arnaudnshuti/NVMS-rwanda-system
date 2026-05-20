import { Router } from "express";
import { prisma } from "../services/prisma.service.js";
export const metaRouter = Router();
metaRouter.get("/districts", async (_req, res) => {
    const rows = await prisma.district.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
    });
    res.json(rows);
});
metaRouter.get("/public-stats", async (_req, res) => {
    const [volunteers, activePrograms, logs, districts] = await Promise.all([
        prisma.user.count({ where: { role: "volunteer" } }),
        prisma.program.count({ where: { status: { in: ["open", "in_progress"] } } }),
        prisma.activityLog.findMany({ select: { hours: true } }),
        prisma.district.count({ where: { isActive: true } }),
    ]);
    res.json({
        volunteers,
        activePrograms,
        hours: Math.round(logs.reduce((sum, l) => sum + Number(l.hours), 0)),
        districts,
    });
});
