import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "./prisma.service.js";

export async function createNotification(input: {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  metadata?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? "INFO",
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

