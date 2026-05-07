import { prisma } from "../services/prisma.service.js";
import { createNotification } from "../services/notification.service.js";

async function processAssignmentStrikes() {
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(`${dayKey}T23:59:59.999Z`);

  const active = await prisma.assignment.findMany({
    where: { status: "active" },
    include: { volunteer: { select: { id: true, name: true, email: true } }, program: { select: { coordinatorUserId: true, title: true } } },
  });

  for (const a of active) {
    const hasTodayLog = await prisma.activityLog.findFirst({
      where: { volunteerId: a.volunteerId, programId: a.programId, date: { gte: start, lte: end } },
      select: { id: true },
    });
    if (hasTodayLog) continue;

    const already = await prisma.notification.findFirst({
      where: {
        userId: a.volunteerId,
        title: "Missing daily report strike",
        createdAt: { gte: start, lte: end },
      },
      select: { id: true },
    });
    if (already) continue;

    const next = await prisma.assignment.update({
      where: { id: a.id },
      data: { strikes: { increment: 1 } },
      select: { strikes: true },
    });

    await createNotification({
      userId: a.volunteerId,
      type: "WARNING",
      title: "Missing daily report strike",
      message: `No daily report for ${a.programTitle} today. Strike ${next.strikes}/3.`,
      metadata: { assignmentId: a.id, programId: a.programId, strike: next.strikes, dayKey },
    });

    if (a.program.coordinatorUserId) {
      await createNotification({
        userId: a.program.coordinatorUserId,
        type: "WARNING",
        title: "Volunteer missing report",
        message: `${a.volunteer.name} missed today's report for ${a.programTitle} (strike ${next.strikes}/3).`,
        metadata: { assignmentId: a.id, volunteerId: a.volunteerId, strike: next.strikes, dayKey },
      });
    }

    if (next.strikes >= 3) {
      await prisma.assignment.update({
        where: { id: a.id },
        data: { status: "completed" },
      });
      await createNotification({
        userId: a.volunteerId,
        type: "ERROR",
        title: "Removed from program",
        message: `You reached 3 missing-report strikes and were removed from ${a.programTitle}.`,
        metadata: { assignmentId: a.id, programId: a.programId, reason: "3_strikes" },
      });
      if (a.program.coordinatorUserId) {
        await createNotification({
          userId: a.program.coordinatorUserId,
          type: "ERROR",
          title: "Volunteer auto-removed",
          message: `${a.volunteer.name} reached 3 strikes and was auto-removed from ${a.programTitle}.`,
          metadata: { assignmentId: a.id, volunteerId: a.volunteerId, reason: "3_strikes" },
        });
      }
    }
  }
}

async function processInviteExpiryReminders() {
  const now = Date.now();
  const users = await prisma.user.findMany({
    where: { role: "coordinator", mustChangePassword: true, isActive: true },
    select: { id: true, createdAt: true, email: true },
  });
  const admins = await prisma.user.findMany({
    where: { role: "admin", isActive: true },
    select: { id: true },
  });
  for (const u of users) {
    const ageHours = (now - u.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours >= 24) {
      const existing = await prisma.notification.findFirst({
        where: { userId: u.id, title: "Invitation expired" },
        select: { id: true },
      });
      if (existing) continue;
      await createNotification({
        userId: u.id,
        type: "ERROR",
        title: "Invitation expired",
        message: "Your temporary invitation expired after 24 hours. Contact admin for reset.",
        metadata: { reason: "invite_expired" },
      });
      await Promise.all(
        admins.map((a) =>
          createNotification({
            userId: a.id,
            type: "WARNING",
            title: "Coordinator invitation expired",
            message: `${u.email} did not complete first login within 24 hours.`,
            metadata: { coordinatorUserId: u.id, reason: "invite_expired" },
          }),
        ),
      );
      continue;
    }
    if (ageHours >= 20) {
      const existing = await prisma.notification.findFirst({
        where: { userId: u.id, title: "Invitation expires soon" },
        select: { id: true },
      });
      if (!existing) {
        await createNotification({
          userId: u.id,
          type: "WARNING",
          title: "Invitation expires soon",
          message: "Your temporary credentials expire in less than 4 hours. Change password now.",
          metadata: { reason: "invite_expiring_soon" },
        });
      }
    }
  }
}

export function startAutomationJobs() {
  // Run once shortly after startup, then every hour.
  setTimeout(() => {
    void processAssignmentStrikes();
    void processInviteExpiryReminders();
  }, 5000);

  setInterval(() => {
    void processAssignmentStrikes();
    void processInviteExpiryReminders();
  }, 60 * 60 * 1000);
}

