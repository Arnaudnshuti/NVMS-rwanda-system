import type { AuditActionType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "./prisma.service.js";

export async function writeAudit(
  actionType: AuditActionType,
  opts: {
    actorUserId?: string | null;
    targetUserId?: string | null;
    req?: Request;
    metadata?: Record<string, unknown> | null;
  } = {},
) {
  const ip =
    opts.req?.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    opts.req?.socket?.remoteAddress ||
    undefined;
  const userAgent = opts.req?.headers["user-agent"]?.toString();

  await prisma.auditLog.create({
    data: {
      actionType,
      actorUserId: opts.actorUserId ?? undefined,
      targetUserId: opts.targetUserId ?? undefined,
      ip,
      userAgent,
      metadata: (opts.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

