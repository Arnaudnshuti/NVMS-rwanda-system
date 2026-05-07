import { prisma } from "./prisma.service.js";
export async function writeAudit(actionType, opts = {}) {
    const ip = opts.req?.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
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
            metadata: (opts.metadata ?? undefined),
        },
    });
}
