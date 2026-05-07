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
