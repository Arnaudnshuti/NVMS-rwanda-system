import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 12);
  const districts = [
    "Gasabo",
    "Kicukiro",
    "Nyarugenge",
    "Musanze",
    "Rubavu",
    "Huye",
    "Bugesera",
    "Nyamasheke",
  ];

  for (const name of districts) {
    await prisma.district.upsert({
      where: { code: name.toLowerCase().replace(/\s+/g, "_") },
      create: { code: name.toLowerCase().replace(/\s+/g, "_"), name },
      update: { name, isActive: true },
    });
  }

  const gasabo = await prisma.district.findUnique({ where: { code: "gasabo" } });

  await prisma.platformConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      volunteerCategories: [
        "General community",
        "Youth mentorship",
        "Health auxiliary",
        "Education support",
        "Emergency response",
        "Agricultural extension",
      ],
      programTypes: [
        "Awareness campaigns",
        "Field deployment",
        "Capacity building",
        "Data collection / M&E",
      ],
    },
    update: {},
  });

  const coordinator = await prisma.user.upsert({
    where: { email: "coordinator@demo.rw" },
    create: {
      email: "coordinator@demo.rw",
      passwordHash,
      name: "Jean-Paul Habimana",
      role: "coordinator",
      isActive: true,
      mustChangePassword: false,
      district: "Gasabo",
      districtId: gasabo?.id,
      phone: "+250 788 000 111",
      verificationStatus: "verified",
      isActive: true,
      mustChangePassword: false,
      govStatus: "active",
    },
    update: {
      passwordHash,
      name: "Jean-Paul Habimana",
      district: "Gasabo",
      districtId: gasabo?.id,
      phone: "+250 788 000 111",
      verificationStatus: "verified",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.rw" },
    create: {
      email: "admin@demo.rw",
      passwordHash,
      name: "Dr. Marie Mukamana",
      role: "admin",
      isActive: true,
      mustChangePassword: false,
      verificationStatus: "verified",
      govStatus: "active",
    },
    update: {
      passwordHash,
      name: "Dr. Marie Mukamana",
      verificationStatus: "verified",
      isActive: true,
      mustChangePassword: false,
    },
  });

  const volunteerSkills = ["Teaching", "Computer Literacy", "Kinyarwanda"];

  const volunteer = await prisma.user.upsert({
    where: { email: "volunteer@demo.rw" },
    create: {
      email: "volunteer@demo.rw",
      passwordHash,
      name: "Aline Uwase",
      role: "volunteer",
      isActive: true,
      mustChangePassword: false,
      district: "Gasabo",
      districtId: gasabo?.id,
      phone: "+250 788 111 222",
      verificationStatus: "verified",
      isActive: true,
      mustChangePassword: false,
      profileTrustStatus: "verified",
      nationalId: "1 1990 8 ****** 1 12",
      profession: "Community educator",
      educationLevel: "Bachelor's degree",
      dateOfBirth: new Date("1991-05-12"),
      volunteerAvailability: "Weekends",
      trustSkillsSummary: volunteerSkills.join(", "),
      skills: volunteerSkills,
      contactPreference: "both",
      hoursContributed: 142,
      programsCompleted: 3,
      rating: 4.8,
      govStatus: "active",
    },
    update: {
      passwordHash,
      name: "Aline Uwase",
      district: "Gasabo",
      districtId: gasabo?.id,
      phone: "+250 788 111 222",
      verificationStatus: "verified",
      profileTrustStatus: "verified",
      nationalId: "1 1990 8 ****** 1 12",
      profession: "Community educator",
      educationLevel: "Bachelor's degree",
      dateOfBirth: new Date("1991-05-12"),
      volunteerAvailability: "Weekends",
      trustSkillsSummary: volunteerSkills.join(", "),
      skills: volunteerSkills,
      hoursContributed: 142,
      programsCompleted: 3,
      rating: 4.8,
    },
  });

  const programsData = [
    {
      id: "p1",
      title: "Umuganda Digital Literacy Drive",
      description:
        "Teach basic digital skills to rural community members across sectors in Gasabo.",
      category: "Education",
      district: "Gasabo",
      sector: "Kinyinya",
      startDate: new Date("2026-05-01"),
      endDate: new Date("2026-07-30"),
      slotsTotal: 50,
      slotsFilled: 32,
      requiredSkills: ["Teaching", "Computer Literacy", "Kinyarwanda"],
      status: "open" as const,
      coordinatorDisplayName: "Jean-Paul Habimana",
    },
    {
      id: "p2",
      title: "Community Health Outreach — Musanze",
      description: "Support health workers with vaccination awareness and maternal health visits.",
      category: "Health",
      district: "Musanze",
      startDate: new Date("2026-04-15"),
      endDate: new Date("2026-06-15"),
      slotsTotal: 30,
      slotsFilled: 30,
      requiredSkills: ["Healthcare", "First Aid", "Communication"],
      status: "in_progress" as const,
      coordinatorDisplayName: "Jean-Paul Habimana",
    },
    {
      id: "p3",
      title: "Reforestation Initiative — Nyungwe",
      description: "Tree planting and environmental education around Nyungwe National Park.",
      category: "Environment",
      district: "Nyamasheke",
      startDate: new Date("2026-05-10"),
      endDate: new Date("2026-08-10"),
      slotsTotal: 120,
      slotsFilled: 78,
      requiredSkills: ["Physical Work", "Environmental Awareness"],
      status: "open" as const,
      coordinatorDisplayName: "Jean-Paul Habimana",
    },
    {
      id: "p4",
      title: "Smart Agriculture Support — Bugesera",
      description: "Train farmers on irrigation and modern crop techniques.",
      category: "Agriculture",
      district: "Bugesera",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-09-01"),
      slotsTotal: 40,
      slotsFilled: 12,
      requiredSkills: ["Agriculture", "Training", "Kinyarwanda"],
      status: "open" as const,
      coordinatorDisplayName: "Jean-Paul Habimana",
    },
    {
      id: "p5",
      title: "Youth Empowerment Workshops — Huye",
      description: "Career guidance and entrepreneurship workshops for secondary school students.",
      category: "Community",
      district: "Huye",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-04-30"),
      slotsTotal: 25,
      slotsFilled: 25,
      requiredSkills: ["Mentoring", "Public Speaking"],
      status: "completed" as const,
      coordinatorDisplayName: "Jean-Paul Habimana",
    },
    {
      id: "p6",
      title: "Flood Response — Rubavu",
      description: "Emergency response team for flood-affected communities.",
      category: "Emergency",
      district: "Rubavu",
      startDate: new Date("2026-04-20"),
      endDate: new Date("2026-05-20"),
      slotsTotal: 60,
      slotsFilled: 45,
      requiredSkills: ["First Aid", "Logistics", "Physical Work"],
      status: "in_progress" as const,
      coordinatorDisplayName: "Jean-Paul Habimana",
    },
  ];

  for (const p of programsData) {
    await prisma.program.upsert({
      where: { id: p.id },
      create: {
        ...p,
        coordinatorUserId: p.district === "Gasabo" ? coordinator.id : undefined,
      },
      update: {
        title: p.title,
        description: p.description,
        category: p.category,
        district: p.district,
        sector: p.sector,
        startDate: p.startDate,
        endDate: p.endDate,
        slotsTotal: p.slotsTotal,
        slotsFilled: p.slotsFilled,
        requiredSkills: p.requiredSkills,
        status: p.status,
        coordinatorDisplayName: p.coordinatorDisplayName,
        coordinatorUserId: p.district === "Gasabo" ? coordinator.id : undefined,
      },
    });
  }

  await prisma.assignment.deleteMany({ where: { volunteerId: volunteer.id } });
  await prisma.activityLog.deleteMany({ where: { volunteerId: volunteer.id } });

  await prisma.assignment.create({
    data: {
      volunteerId: volunteer.id,
      programId: "p1",
      programTitle: "Umuganda Digital Literacy Drive",
      district: "Gasabo",
      startDate: new Date("2026-05-01"),
      endDate: new Date("2026-07-30"),
      status: "active",
      hoursLogged: 32,
    },
  });

  await prisma.activityLog.createMany({
    data: [
      {
        volunteerId: volunteer.id,
        programId: "p1",
        date: new Date("2026-04-25"),
        hours: 4,
        description: "Taught 12 community members basic Excel and Word.",
        status: "approved",
      },
      {
        volunteerId: volunteer.id,
        programId: "p1",
        date: new Date("2026-04-22"),
        hours: 5,
        description: "Organized enrollment of new learners for digital literacy class.",
        status: "approved",
      },
      {
        volunteerId: volunteer.id,
        programId: "p1",
        date: new Date("2026-04-26"),
        hours: 3,
        description: "Follow-up session with previous learners.",
        status: "pending",
      },
    ],
  });

  console.log("Seed complete:", { coordinator: coordinator.email, admin: admin.email, volunteer: volunteer.email });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
