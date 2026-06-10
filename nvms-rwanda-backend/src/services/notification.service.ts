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

export async function notifyDistrictCoordinators(input: {
  district?: string | null;
  title: string;
  message: string;
  type?: NotificationType;
  metadata?: Record<string, unknown>;
}) {
  if (!input.district) return [];
  const coordinators = await prisma.user.findMany({
    where: {
      role: "coordinator",
      isActive: true,
      govStatus: "active",
      district: input.district,
    },
    select: { id: true },
  });
  return Promise.all(
    coordinators.map((c) =>
      createNotification({
        userId: c.id,
        title: input.title,
        message: input.message,
        type: input.type,
        metadata: input.metadata,
      }),
    ),
  );
}

export async function notifyProgramCoordinators(input: {
  coordinatorUserId?: string | null;
  district?: string | null;
  title: string;
  message: string;
  type?: NotificationType;
  metadata?: Record<string, unknown>;
}) {
  if (input.coordinatorUserId) {
    return [
      await createNotification({
        userId: input.coordinatorUserId,
        title: input.title,
        message: input.message,
        type: input.type,
        metadata: input.metadata,
      }),
    ];
  }

  return notifyDistrictCoordinators({
    district: input.district,
    title: input.title,
    message: input.message,
    type: input.type,
    metadata: input.metadata,
  });
}

