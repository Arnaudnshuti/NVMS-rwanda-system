import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";
import { hashPassword } from "../services/auth.service.js";
import { writeAudit } from "../services/audit.service.js";
import { sendTemplatedEmail } from "../services/email/mailer.js";
import { createNotification } from "../services/notification.service.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { validateRwandaPhone } from "../utils/validation.js";
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRoles("admin"));
const createCoordinatorSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.enum(["coordinator", "admin"]).default("coordinator"),
    district: z.string().min(1).optional(),
    districtId: z.string().min(1).optional(),
    phone: z.string().min(3).optional(),
    temporaryPassword: z.string().min(8).optional(),
});
function generateTemporaryPassword() {
    return `NVMS-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString().slice(-4)}`;
}
adminRouter.post("/users", async (req, res) => {
    const parsed = createCoordinatorSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const email = parsed.data.email.trim().toLowerCase();
    const role = parsed.data.role;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists)
        return res.status(409).json({ error: "User with this email already exists" });
    let districtId = undefined;
    let districtName = parsed.data.district?.trim();
    if (parsed.data.districtId) {
        const d = await prisma.district.findUnique({ where: { id: parsed.data.districtId } });
        if (!d || !d.isActive)
            return res.status(400).json({ error: "Invalid districtId" });
        districtId = d.id;
        districtName = d.name;
    }
    else if (districtName) {
        const d = await prisma.district.findUnique({ where: { name: districtName } });
        if (d?.isActive)
            districtId = d.id;
    }
    if (role === "coordinator" && !districtName) {
        return res.status(400).json({ error: "district or districtId is required for coordinators" });
    }
    const tempPassword = parsed.data.temporaryPassword ?? generateTemporaryPassword();
    const phoneCheck = parsed.data.phone ? validateRwandaPhone(parsed.data.phone) : null;
    if (phoneCheck && !phoneCheck.ok)
        return res.status(400).json({ error: phoneCheck.error });
    const passwordHash = await hashPassword(tempPassword);
    const created = await prisma.user.create({
        data: {
            name: parsed.data.name.trim(),
            email,
            role,
            district: role === "coordinator" ? districtName : undefined,
            districtId: role === "coordinator" ? districtId : undefined,
            phone: phoneCheck?.value,
            passwordHash,
            isActive: true,
            mustChangePassword: true,
            govStatus: "active",
            verificationStatus: "verified",
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            district: true,
            districtId: true,
            phone: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,
        },
    });
    await writeAudit("ADMIN_COORDINATOR_CREATED", {
        actorUserId: req.userId,
        targetUserId: created.id,
        req,
        metadata: { role, district: created.district, districtId: created.districtId, email: created.email },
    });
    const link = process.env.SYSTEM_LOGIN_LINK ?? "http://localhost:5173/login";
    await sendTemplatedEmail({
        templateId: "coordinator_invite",
        to: created.email,
        actorUserId: req.userId,
        targetUserId: created.id,
        vars: {
            name: created.name,
            email: created.email,
            password: tempPassword,
            link,
            role,
            district: created.district ?? "",
        },
    });
    await createNotification({
        userId: created.id,
        type: "INFO",
        title: role === "coordinator" ? "You were invited as coordinator" : "You were invited as ministry administrator",
        message: "Use temporary credentials from your invitation email and change password within 24 hours.",
        metadata: { district: created.district },
    });
    res.status(201).json({ user: created, temporaryPassword: tempPassword });
});
adminRouter.get("/users", async (_req, res) => {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            district: true,
            phone: true,
            isActive: true,
            mustChangePassword: true,
            mfaResetPending: true,
            govStatus: true,
            verificationStatus: true,
            profileTrustStatus: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    res.json(users);
});
adminRouter.get("/audit-logs", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const take = Math.min(200, Math.max(1, Number(req.query.take ?? 100) || 100));
    const logs = await prisma.auditLog.findMany({
        take,
        orderBy: { createdAt: "desc" },
        where: q
            ? {
                OR: [
                    { actionType: { equals: q.toUpperCase() } },
                    { metadata: { path: ["email"], string_contains: q } },
                    { metadata: { path: ["to"], string_contains: q } },
                ],
            }
            : undefined,
        select: {
            id: true,
            actionType: true,
            actorUserId: true,
            actorUser: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
            },
            targetUserId: true,
            targetUser: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
            },
            ip: true,
            userAgent: true,
            metadata: true,
            createdAt: true,
        },
    });
    res.json(logs);
});
adminRouter.get("/platform-config", async (_req, res) => {
    const row = await prisma.platformConfig.findUnique({ where: { id: 1 } });
    if (!row) {
        return res.json({
            volunteerCategories: [],
            programTypes: [],
        });
    }
    res.json({
        volunteerCategories: row.volunteerCategories,
        programTypes: row.programTypes,
        organizationName: row.organizationName ?? "Ministry of Local Government — Rwanda",
        contactEmail: row.contactEmail ?? "volunteer@minaloc.gov.rw",
        supportPhone: row.supportPhone ?? "+250 788 000 000",
    });
});
const platformSchema = z.object({
    volunteerCategories: z.array(z.string()),
    programTypes: z.array(z.string()),
    organizationName: z.string().optional(),
    contactEmail: z.string().optional(),
    supportPhone: z.string().optional(),
});
adminRouter.put("/platform-config", async (req, res) => {
    const parsed = platformSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const row = await prisma.platformConfig.upsert({
        where: { id: 1 },
        create: {
            id: 1,
            volunteerCategories: parsed.data.volunteerCategories.filter(Boolean),
            programTypes: parsed.data.programTypes.filter(Boolean),
            organizationName: parsed.data.organizationName,
            contactEmail: parsed.data.contactEmail,
            supportPhone: parsed.data.supportPhone,
        },
        update: {
            volunteerCategories: parsed.data.volunteerCategories.filter(Boolean),
            programTypes: parsed.data.programTypes.filter(Boolean),
            organizationName: parsed.data.organizationName,
            contactEmail: parsed.data.contactEmail,
            supportPhone: parsed.data.supportPhone,
        },
    });
    res.json({
        volunteerCategories: row.volunteerCategories,
        programTypes: row.programTypes,
        organizationName: row.organizationName ?? undefined,
        contactEmail: row.contactEmail ?? undefined,
        supportPhone: row.supportPhone ?? undefined,
    });
});
adminRouter.patch("/users/:userId/resend-invite", async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!target || target.role !== "coordinator")
        return res.status(404).json({ error: "Coordinator not found" });
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await prisma.user.update({
        where: { id: target.id },
        data: { passwordHash, mustChangePassword: true, isActive: true, govStatus: "active" },
    });
    const link = process.env.SYSTEM_LOGIN_LINK ?? "http://localhost:5173/login";
    await sendTemplatedEmail({
        templateId: "coordinator_invite",
        to: target.email,
        actorUserId: req.userId,
        targetUserId: target.id,
        vars: {
            name: target.name,
            email: target.email,
            password: temporaryPassword,
            link,
            role: "coordinator",
            district: target.district ?? "",
        },
    });
    await createNotification({
        userId: target.id,
        type: "INFO",
        title: "Invitation re-sent",
        message: "Admin re-sent temporary credentials. Please sign in and change password immediately.",
        metadata: { resentBy: req.userId },
    });
    res.json({ ok: true, temporaryPassword });
});
async function buildNationalReport(filterDistrict) {
    const districtFilter = filterDistrict?.trim();
    const programWhere = districtFilter ? { district: districtFilter } : {};
    const volunteerWhere = {
        role: "volunteer",
        ...(districtFilter ? { district: districtFilter } : {}),
    };
    const coordinatorWhere = {
        role: "coordinator",
        ...(districtFilter ? { district: districtFilter } : {}),
    };
    const applicationWhere = districtFilter ? { program: { district: districtFilter } } : {};
    const activityWhere = districtFilter ? { program: { district: districtFilter } } : {};
    const districtWhere = districtFilter ? { isActive: true, name: districtFilter } : { isActive: true };
    const [totalUsers, volunteers, coordinators, admins, verifiedVolunteers, pendingVolunteers, programs, activePrograms, completedPrograms, applications, acceptedApplications, pendingApplications, activityLogs, approvedLogs, districts, programStatus, applicationStatus, categoryDistribution, recentApplications, recentActivity, applicationRows, programRows,] = await Promise.all([
        prisma.user.count({ where: districtFilter ? { OR: [{ district: districtFilter }, { role: "admin" }] } : undefined }),
        prisma.user.count({ where: volunteerWhere }),
        prisma.user.count({ where: coordinatorWhere }),
        prisma.user.count({ where: { role: "admin" } }),
        prisma.user.count({ where: { ...volunteerWhere, verificationStatus: "verified" } }),
        prisma.user.count({ where: { ...volunteerWhere, verificationStatus: "pending" } }),
        prisma.program.count({ where: programWhere }),
        prisma.program.count({ where: { ...programWhere, status: { in: ["open", "in_progress"] } } }),
        prisma.program.count({ where: { ...programWhere, status: "completed" } }),
        prisma.programApplication.count({ where: applicationWhere }),
        prisma.programApplication.count({ where: { ...applicationWhere, status: "accepted" } }),
        prisma.programApplication.count({ where: { ...applicationWhere, status: { in: ["submitted", "under_review", "waitlisted"] } } }),
        prisma.activityLog.count({ where: activityWhere }),
        prisma.activityLog.count({ where: { ...activityWhere, status: "approved" } }),
        prisma.district.findMany({
            where: districtWhere,
            orderBy: { name: "asc" },
            select: {
                name: true,
                _count: { select: { users: true, programs: true } },
            },
        }),
        prisma.program.groupBy({ by: ["status"], where: programWhere, _count: { _all: true }, orderBy: { status: "asc" } }),
        prisma.programApplication.groupBy({ by: ["status"], where: applicationWhere, _count: { _all: true }, orderBy: { status: "asc" } }),
        prisma.program.groupBy({ by: ["category"], where: programWhere, _count: { _all: true }, orderBy: { category: "asc" } }),
        prisma.programApplication.findMany({
            where: applicationWhere,
            orderBy: { submittedAt: "desc" },
            take: 8,
            select: {
                id: true,
                status: true,
                submittedAt: true,
                volunteer: { select: { name: true, email: true, district: true } },
                program: { select: { title: true, district: true } },
            },
        }),
        prisma.activityLog.findMany({
            where: activityWhere,
            orderBy: { date: "desc" },
            take: 8,
            select: {
                id: true,
                date: true,
                hours: true,
                status: true,
                volunteer: { select: { name: true, district: true } },
                program: { select: { title: true, district: true } },
            },
        }),
        prisma.programApplication.findMany({
            where: applicationWhere,
            orderBy: { submittedAt: "desc" },
            take: 500,
            select: {
                id: true,
                status: true,
                submittedAt: true,
                reviewedAt: true,
                coordinatorNote: true,
                volunteer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        district: true,
                        verificationStatus: true,
                        profileTrustStatus: true,
                    },
                },
                program: {
                    select: {
                        id: true,
                        title: true,
                        category: true,
                        district: true,
                        status: true,
                    },
                },
            },
        }),
        prisma.program.findMany({
            where: programWhere,
            orderBy: [{ status: "asc" }, { startDate: "desc" }],
            take: 500,
            select: {
                id: true,
                title: true,
                category: true,
                district: true,
                sector: true,
                status: true,
                startDate: true,
                endDate: true,
                slotsTotal: true,
                slotsFilled: true,
                requiredSkills: true,
                _count: {
                    select: {
                        applications: true,
                        assignments: true,
                        activityLogs: true,
                    },
                },
            },
        }),
    ]);
    const [hoursByDistrict, appsByDistrict, approvedHours, volunteersByDistrict] = await Promise.all([
        prisma.activityLog.findMany({
            where: { ...activityWhere, status: "approved" },
            select: { hours: true, program: { select: { district: true } } },
        }),
        prisma.programApplication.findMany({
            where: applicationWhere,
            select: { program: { select: { district: true } } },
        }),
        prisma.activityLog.aggregate({
            where: { ...activityWhere, status: "approved" },
            _sum: { hours: true },
        }),
        prisma.user.groupBy({
            by: ["district"],
            where: volunteerWhere,
            _count: { _all: true },
        }),
    ]);
    const hoursMap = new Map();
    for (const row of hoursByDistrict) {
        hoursMap.set(row.program.district, (hoursMap.get(row.program.district) ?? 0) + Number(row.hours));
    }
    const appsMap = new Map();
    for (const row of appsByDistrict) {
        appsMap.set(row.program.district, (appsMap.get(row.program.district) ?? 0) + 1);
    }
    const volunteersMap = new Map();
    for (const row of volunteersByDistrict) {
        if (row.district)
            volunteersMap.set(row.district, row._count._all);
    }
    return {
        generatedAt: new Date().toISOString(),
        filter: { district: districtFilter ?? null },
        metrics: {
            totalUsers,
            volunteers,
            coordinators,
            admins,
            verifiedVolunteers,
            pendingVolunteers,
            programs,
            activePrograms,
            completedPrograms,
            applications,
            acceptedApplications,
            pendingApplications,
            activityLogs,
            approvedLogs,
            approvedHours: Math.round(Number(approvedHours._sum.hours ?? 0)),
        },
        byDistrict: districts
            .map((d) => ({
            district: d.name,
            volunteers: volunteersMap.get(d.name) ?? 0,
            programs: d._count.programs,
            applications: appsMap.get(d.name) ?? 0,
            hours: Math.round(hoursMap.get(d.name) ?? 0),
        }))
            .sort((a, b) => b.volunteers - a.volunteers),
        programStatus: programStatus.map((s) => ({ status: s.status, count: s._count._all })),
        applicationStatus: applicationStatus.map((s) => ({ status: s.status, count: s._count._all })),
        categoryDistribution: categoryDistribution.map((c) => ({ category: c.category, count: c._count._all })),
        recentApplications: recentApplications.map((a) => ({
            id: a.id,
            submittedAt: a.submittedAt.toISOString(),
            status: a.status,
            volunteerName: a.volunteer.name,
            volunteerEmail: a.volunteer.email,
            volunteerDistrict: a.volunteer.district ?? "Unassigned",
            programTitle: a.program.title,
            programDistrict: a.program.district,
        })),
        recentActivity: recentActivity.map((a) => ({
            id: a.id,
            date: a.date.toISOString(),
            hours: Number(a.hours),
            status: a.status,
            volunteerName: a.volunteer.name,
            volunteerDistrict: a.volunteer.district ?? "Unassigned",
            programTitle: a.program.title,
            programDistrict: a.program.district,
        })),
        volunteerApplications: applicationRows.map((a) => ({
            id: a.id,
            submittedAt: a.submittedAt.toISOString(),
            reviewedAt: a.reviewedAt?.toISOString() ?? null,
            status: a.status,
            coordinatorNote: a.coordinatorNote ?? null,
            volunteerId: a.volunteer.id,
            volunteerName: a.volunteer.name,
            volunteerEmail: a.volunteer.email,
            volunteerPhone: a.volunteer.phone,
            volunteerDistrict: a.volunteer.district ?? "Unassigned",
            volunteerVerificationStatus: a.volunteer.verificationStatus,
            volunteerTrustStatus: a.volunteer.profileTrustStatus,
            programId: a.program.id,
            programTitle: a.program.title,
            programCategory: a.program.category,
            programDistrict: a.program.district,
            programStatus: a.program.status,
        })),
        programs: programRows.map((p) => ({
            id: p.id,
            title: p.title,
            category: p.category,
            district: p.district,
            sector: p.sector,
            status: p.status,
            startDate: p.startDate.toISOString().slice(0, 10),
            endDate: p.endDate.toISOString().slice(0, 10),
            slotsTotal: p.slotsTotal,
            slotsFilled: p.slotsFilled,
            applications: p._count.applications,
            assignments: p._count.assignments,
            reports: p._count.activityLogs,
            requiredSkills: p.requiredSkills,
        })),
    };
}
adminRouter.get("/reports/summary", async (req, res) => {
    const district = typeof req.query.district === "string" && req.query.district !== "all" ? req.query.district : undefined;
    res.json(await buildNationalReport(district));
});
adminRouter.get("/analytics", async (_req, res) => {
    const [logs, districts, programGroups, volunteersByDistrict] = await Promise.all([
        prisma.activityLog.findMany({
            where: { status: "approved" },
            select: { date: true, hours: true },
            orderBy: { date: "asc" },
        }),
        prisma.district.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: {
                id: true,
                code: true,
                name: true,
                _count: { select: { users: true, programs: true } },
            },
        }),
        prisma.program.groupBy({
            by: ["category"],
            _count: { _all: true },
            orderBy: { category: "asc" },
        }),
        prisma.user.groupBy({
            by: ["district"],
            where: { role: "volunteer" },
            _count: { _all: true },
        }),
    ]);
    const monthFmt = new Intl.DateTimeFormat("en", { month: "short" });
    const monthlyMap = new Map();
    for (const l of await prisma.activityLog.findMany({ where: { status: "approved" }, select: { volunteerId: true, date: true, hours: true } })) {
        const key = `${l.date.getUTCFullYear()}-${String(l.date.getUTCMonth() + 1).padStart(2, "0")}`;
        const row = monthlyMap.get(key) ?? { month: monthFmt.format(l.date), volunteers: new Set(), hours: 0 };
        row.volunteers.add(l.volunteerId);
        row.hours += Number(l.hours);
        monthlyMap.set(key, row);
    }
    const hoursByDistrict = await prisma.activityLog.findMany({
        where: { status: "approved" },
        select: { hours: true, program: { select: { district: true } } },
    });
    const hoursMap = new Map();
    for (const l of hoursByDistrict) {
        hoursMap.set(l.program.district, (hoursMap.get(l.program.district) ?? 0) + Number(l.hours));
    }
    const volunteersMap = new Map();
    for (const row of volunteersByDistrict) {
        if (row.district)
            volunteersMap.set(row.district, row._count._all);
    }
    res.json({
        monthlyParticipation: Array.from(monthlyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, r]) => ({ month: r.month, volunteers: r.volunteers.size, hours: Math.round(r.hours) })),
        districtParticipation: districts.map((d) => ({
            district: d.name,
            volunteers: volunteersMap.get(d.name) ?? 0,
            programs: d._count.programs,
            hours: Math.round(hoursMap.get(d.name) ?? 0),
        })),
        categoryDistribution: programGroups.map((g) => ({ name: g.category, value: g._count._all })),
        totals: {
            hours: Math.round(logs.reduce((sum, l) => sum + Number(l.hours), 0)),
            districts: districts.length,
        },
    });
});
function addSheet(wb, name, rows) {
    const sheet = wb.addWorksheet(name.slice(0, 31));
    const sample = rows[0] ?? { message: "No rows for selected report" };
    sheet.columns = Object.keys(sample).map((key) => ({ header: key, key, width: Math.max(16, Math.min(34, key.length + 8)) }));
    rows.forEach((row) => sheet.addRow(row));
}
adminRouter.get("/reports/export", async (req, res) => {
    const format = String(req.query.format ?? "csv").toLowerCase();
    const district = typeof req.query.district === "string" && req.query.district !== "all" ? req.query.district : undefined;
    const selectedSections = String(req.query.sections ?? "overview,districts,volunteers,programs")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const sections = new Set(selectedSections.length ? selectedSections : ["overview", "districts", "volunteers", "programs"]);
    const report = await buildNationalReport(district);
    const districtRows = report.byDistrict.map((r) => ({
        district: r.district,
        volunteers: r.volunteers,
        programs: r.programs,
        applications: r.applications,
        approvedHours: r.hours,
    }));
    const volunteerRows = report.volunteerApplications.map((r) => ({
        volunteerName: r.volunteerName,
        volunteerEmail: r.volunteerEmail,
        volunteerDistrict: r.volunteerDistrict,
        programTitle: r.programTitle,
        programDistrict: r.programDistrict,
        applicationStatus: r.status,
        submittedAt: r.submittedAt,
    }));
    const programRows = report.programs.map((p) => ({
        title: p.title,
        category: p.category,
        district: p.district,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        slots: `${p.slotsFilled}/${p.slotsTotal}`,
        applications: p.applications,
        assignments: p.assignments,
        reports: p.reports,
    }));
    if (format === "xlsx") {
        const wb = new ExcelJS.Workbook();
        wb.creator = "NVMS Rwanda";
        if (sections.has("overview")) {
            const overview = wb.addWorksheet("Overview");
            overview.columns = [
                { header: "Metric", key: "metric", width: 30 },
                { header: "Value", key: "value", width: 18 },
            ];
            overview.addRow({ metric: "District filter", value: district ?? "All districts" });
            Object.entries(report.metrics).forEach(([metric, value]) => overview.addRow({ metric, value }));
        }
        if (sections.has("districts"))
            addSheet(wb, "Districts", districtRows);
        if (sections.has("volunteers"))
            addSheet(wb, "Volunteers and applications", volunteerRows);
        if (sections.has("programs"))
            addSheet(wb, "Programs", programRows);
        const buf = await wb.xlsx.writeBuffer();
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="nvms-report.xlsx"');
        return res.send(Buffer.from(buf));
    }
    if (format === "pdf") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="nvms-report.pdf"');
        const doc = new PDFDocument({ margin: 42, size: "A4", bufferPages: true });
        doc.pipe(res);
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const formatNumber = (n) => n.toLocaleString("en-US");
        const ensureRoom = (height = 90) => {
            if (doc.y + height > doc.page.height - doc.page.margins.bottom)
                doc.addPage();
        };
        const section = (title, subtitle) => {
            ensureRoom(70);
            doc.moveDown(1);
            const x = doc.page.margins.left;
            doc.x = x;
            doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f172a").text(title, x, doc.y, {
                width: pageWidth,
                align: "center",
            });
            if (subtitle) {
                doc.x = x;
                doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(subtitle, x, doc.y + 2, {
                    width: pageWidth,
                    align: "center",
                });
            }
            doc.moveTo(x, doc.y + 8).lineTo(x + pageWidth, doc.y + 8).strokeColor("#d7dee8").stroke();
            doc.moveDown(0.9);
        };
        const metric = (label, value, x, y, width) => {
            doc.roundedRect(x, y, width, 62, 8).fillAndStroke("#f8fafc", "#dbe4ee");
            doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), x + 10, y + 11, { width: width - 20 });
            doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(18).text(value, x + 10, y + 31, { width: width - 20 });
        };
        const row = (cols, y) => {
            cols.forEach((c) => {
                doc.font(c.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(c.bold ? "#334155" : "#111827").text(c.text, c.x, y, { width: c.width, ellipsis: true });
            });
        };
        const marginLeft = doc.page.margins.left;
        doc.rect(0, 0, doc.page.width, 132).fill("#075985");
        doc.fillColor("#dbeafe").font("Helvetica-Bold").fontSize(9).text("NATIONAL VOLUNTEER MANAGEMENT SYSTEM", marginLeft, 28, {
            width: pageWidth,
            align: "center",
            characterSpacing: 0.5,
        });
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text("NVMS Rwanda Report", marginLeft, 47, {
            width: pageWidth,
            align: "center",
        });
        doc.fillColor("#e0f2fe").font("Helvetica").fontSize(10).text(district ?? "All districts", marginLeft, 80, {
            width: pageWidth,
            align: "center",
        });
        doc.fillColor("#bfdbfe").font("Helvetica").fontSize(8.5).text(`Generated ${new Date(report.generatedAt).toLocaleString("en-RW")}`, marginLeft, 98, {
            width: pageWidth,
            align: "center",
        });
        const startY = 154;
        const cardWidth = (pageWidth - 30) / 4;
        metric("Volunteers", formatNumber(report.metrics.volunteers), marginLeft, startY, cardWidth);
        metric("Active programs", formatNumber(report.metrics.activePrograms), marginLeft + cardWidth + 10, startY, cardWidth);
        metric("Applications", formatNumber(report.metrics.applications), marginLeft + (cardWidth + 10) * 2, startY, cardWidth);
        metric("Approved hours", formatNumber(report.metrics.approvedHours), marginLeft + (cardWidth + 10) * 3, startY, cardWidth);
        doc.y = startY + 84;
        if (sections.has("overview")) {
            section("Summary", "Key national or district totals.");
            [
                `Verified volunteers: ${formatNumber(report.metrics.verifiedVolunteers)}`,
                `Pending volunteer approval: ${formatNumber(report.metrics.pendingVolunteers)}`,
                `Completed programs: ${formatNumber(report.metrics.completedPrograms)}`,
                `Accepted applications: ${formatNumber(report.metrics.acceptedApplications)}`,
                `Reports approved: ${formatNumber(report.metrics.approvedLogs)}`,
            ].forEach((line) => doc.font("Helvetica").fontSize(10).fillColor("#111827").text(line, { lineGap: 4 }));
        }
        if (sections.has("districts")) {
            section("Districts", "Volunteer registrations, programs, applications, and approved hours.");
            const x = doc.page.margins.left;
            row([
                { text: "District", x, width: 150, bold: true },
                { text: "Volunteers", x: x + 160, width: 70, bold: true },
                { text: "Programs", x: x + 240, width: 70, bold: true },
                { text: "Applications", x: x + 320, width: 80, bold: true },
                { text: "Hours", x: x + 420, width: 70, bold: true },
            ], doc.y);
            doc.y += 16;
            report.byDistrict.slice(0, 18).forEach((r) => {
                ensureRoom(20);
                const y = doc.y;
                row([
                    { text: r.district, x, width: 150 },
                    { text: formatNumber(r.volunteers), x: x + 160, width: 70 },
                    { text: formatNumber(r.programs), x: x + 240, width: 70 },
                    { text: formatNumber(r.applications), x: x + 320, width: 80 },
                    { text: formatNumber(r.hours), x: x + 420, width: 70 },
                ], y);
                doc.y = y + 16;
            });
        }
        if (sections.has("volunteers")) {
            section("Volunteers and applications", "Volunteer program applications in the selected scope.");
            const x = doc.page.margins.left;
            row([
                { text: "Volunteer", x, width: 135, bold: true },
                { text: "Program", x: x + 145, width: 180, bold: true },
                { text: "District", x: x + 335, width: 80, bold: true },
                { text: "Status", x: x + 425, width: 80, bold: true },
            ], doc.y);
            doc.y += 16;
            report.volunteerApplications.slice(0, 28).forEach((a) => {
                ensureRoom(20);
                const y = doc.y;
                row([
                    { text: a.volunteerName, x, width: 135 },
                    { text: a.programTitle, x: x + 145, width: 180 },
                    { text: a.programDistrict, x: x + 335, width: 80 },
                    { text: a.status.replace(/_/g, " "), x: x + 425, width: 80 },
                ], y);
                doc.y = y + 16;
            });
        }
        if (sections.has("programs")) {
            section("Programs", "Programs in the selected scope.");
            const x = doc.page.margins.left;
            row([
                { text: "Program", x, width: 190, bold: true },
                { text: "Category", x: x + 200, width: 90, bold: true },
                { text: "District", x: x + 300, width: 80, bold: true },
                { text: "Status", x: x + 390, width: 75, bold: true },
                { text: "Slots", x: x + 470, width: 45, bold: true },
            ], doc.y);
            doc.y += 16;
            report.programs.slice(0, 28).forEach((p) => {
                ensureRoom(20);
                const y = doc.y;
                row([
                    { text: p.title, x, width: 190 },
                    { text: p.category, x: x + 200, width: 90 },
                    { text: p.district, x: x + 300, width: 80 },
                    { text: p.status.replace(/_/g, " "), x: x + 390, width: 75 },
                    { text: `${p.slotsFilled}/${p.slotsTotal}`, x: x + 470, width: 45 },
                ], y);
                doc.y = y + 16;
            });
        }
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i += 1) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor("#64748b").text(`NVMS Rwanda | Page ${i + 1} of ${pages.count}`, 42, 800, {
                width: pageWidth,
                align: "center",
            });
        }
        doc.end();
        return;
    }
    if (format === "docx") {
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({ children: [new TextRun({ text: "NVMS Rwanda National Report", bold: true, size: 32 })] }),
                        new Paragraph(`Generated: ${new Date(report.generatedAt).toLocaleString("en-RW")}`),
                        new Paragraph(`Volunteers: ${report.metrics.volunteers}`),
                        new Paragraph(`Active programs: ${report.metrics.activePrograms}`),
                        new Paragraph(`Applications: ${report.metrics.applications}`),
                        new Paragraph(`Approved hours: ${report.metrics.approvedHours}`),
                        ...report.byDistrict.slice(0, 30).map((r) => new Paragraph(`${r.district}: ${r.volunteers} volunteers, ${r.programs} programs, ${r.hours} hours`)),
                    ],
                },
            ],
        });
        const buf = await Packer.toBuffer(doc);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", 'attachment; filename="nvms-report.docx"');
        return res.send(buf);
    }
    // default csv (excel-compatible)
    const csvRows = sections.has("volunteers") ? volunteerRows : sections.has("programs") ? programRows : districtRows;
    const header = Object.keys(csvRows[0] ?? { message: "No rows for selected report" });
    const csv = [header.join(","), ...csvRows.map((r) => header.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="nvms-report.csv"');
    return res.send(csv);
});
const govSchema = z.object({
    govStatus: z.enum(["active", "suspended", "revoked"]),
});
adminRouter.patch("/users/:userId/gov-status", async (req, res) => {
    const parsed = govSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const updated = await prisma.user.update({
        where: { id: req.params.userId },
        data: { govStatus: parsed.data.govStatus },
        select: { id: true, email: true, govStatus: true },
    });
    res.json(updated);
});
const updateUserSchema = z.object({
    district: z.string().min(1).optional(),
    districtId: z.string().min(1).optional(),
    govStatus: z.enum(["active", "suspended", "revoked"]).optional(),
    isActive: z.boolean().optional(),
    mfaResetPending: z.boolean().optional(),
});
adminRouter.patch("/users/:userId", async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    let districtName = parsed.data.district;
    let districtId = parsed.data.districtId;
    if (districtId) {
        const d = await prisma.district.findUnique({ where: { id: districtId } });
        if (!d || !d.isActive)
            return res.status(400).json({ error: "Invalid districtId" });
        districtName = d.name;
    }
    else if (districtName) {
        const d = await prisma.district.findUnique({ where: { name: districtName } });
        if (d?.isActive)
            districtId = d.id;
    }
    const updated = await prisma.user.update({
        where: { id: req.params.userId },
        data: {
            ...(districtName !== undefined ? { district: districtName } : {}),
            ...(districtId !== undefined ? { districtId } : {}),
            ...(parsed.data.govStatus !== undefined ? { govStatus: parsed.data.govStatus } : {}),
            ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
            ...(parsed.data.mfaResetPending !== undefined ? { mfaResetPending: parsed.data.mfaResetPending } : {}),
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            district: true,
            phone: true,
            isActive: true,
            mustChangePassword: true,
            mfaResetPending: true,
            govStatus: true,
            verificationStatus: true,
            profileTrustStatus: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    await writeAudit("ADMIN_PASSWORD_RESET", {
        actorUserId: req.userId,
        targetUserId: updated.id,
        req,
        metadata: { action: "admin_user_updated", email: updated.email },
    });
    res.json(updated);
});
adminRouter.patch("/users/:userId/activate", async (req, res) => {
    const updated = await prisma.user.update({
        where: { id: req.params.userId },
        data: { isActive: true, govStatus: "active" },
        select: { id: true, email: true, isActive: true, govStatus: true },
    });
    res.json(updated);
});
adminRouter.patch("/users/:userId/deactivate", async (req, res) => {
    const updated = await prisma.user.update({
        where: { id: req.params.userId },
        data: { isActive: false, govStatus: "suspended" },
        select: { id: true, email: true, isActive: true, govStatus: true },
    });
    res.json(updated);
});
const resetPasswordSchema = z.object({
    temporaryPassword: z.string().min(8).optional(),
});
adminRouter.patch("/users/:userId/reset-password", async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const temporaryPassword = parsed.data.temporaryPassword ?? generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const updated = await prisma.user.update({
        where: { id: req.params.userId },
        data: { passwordHash, mustChangePassword: true },
        select: { id: true, email: true, mustChangePassword: true },
    });
    await writeAudit("ADMIN_PASSWORD_RESET", {
        actorUserId: req.userId,
        targetUserId: updated.id,
        req,
        metadata: { email: updated.email },
    });
    res.json({ user: updated, temporaryPassword });
});
