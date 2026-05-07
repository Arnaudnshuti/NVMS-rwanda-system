// Mock data for the Intelligent National Volunteer Management System
// Replace with Lovable Cloud calls in Phase 2

export type UserRole = "volunteer" | "coordinator" | "admin";

/** Volunteer account lifecycle after self-registration (coordinator/admin are provisioned as verified). */
export type VolunteerVerificationStatus = "pending" | "verified" | "rejected";

/** After account approval: identity & documents reviewed before deployment to programs. */
export type ProfileTrustStatus = "unsubmitted" | "pending_review" | "verified" | "rejected";

export interface DemoUser {
  id: string;
  email: string;
  /** Present for offline demo accounts; omitted when hydrated from the API. */
  password?: string;
  name: string;
  role: UserRole;
  avatar?: string;
  district?: string;
  phone?: string;
  /** Volunteers: pending until a coordinator verifies. Staff roles behave as verified regardless. */
  verificationStatus?: VolunteerVerificationStatus;
  /** @deprecated Coordinators use `district` only (one district). Ignored by portal logic. */
  coordinatorScopeDistricts?: string[];
  /** How the volunteer prefers approval / alerts once messaging is connected. */
  contactPreference?: "email" | "sms" | "both";
  /** Trusted volunteer (KYC) — required for program deployment in NVMS. */
  profileTrustStatus?: ProfileTrustStatus;
  nationalId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  /** Comma-separated or single-line skills for KYC (synced to profile when backend exists). */
  trustSkillsSummary?: string;
  /** Mock file metadata until uploads go to object storage. */
  identityDocuments?: { label: string; fileName: string }[];
  /** Structured registration / profile fields (persisted via registry API in production). */
  dateOfBirth?: string;
  profession?: string;
  educationLevel?: string;
  /** Volunteer-edited availability (overrides roster default when set). */
  volunteerAvailability?: string;
  /** Mirror of backend roster skills when using API mode. */
  skills?: string[];
  hoursContributed?: number;
  programsCompleted?: number;
  rating?: number;
  /** Administrative lifecycle (API-backed). */
  govStatus?: "active" | "suspended" | "revoked";
  isActive?: boolean;
  mustChangePassword?: boolean;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: "u1",
    email: "volunteer@demo.rw",
    password: "demo1234",
    name: "Aline Uwase",
    role: "volunteer",
    district: "Gasabo",
    phone: "+250 788 111 222",
    verificationStatus: "verified",
    profileTrustStatus: "verified",
    nationalId: "1 1990 8 ****** 1 12",
    profession: "Community educator",
    educationLevel: "Bachelor's degree",
    dateOfBirth: "1991-05-12",
  },
  {
    id: "u2",
    email: "coordinator@demo.rw",
    password: "demo1234",
    name: "Jean-Paul Habimana",
    role: "coordinator",
    district: "Gasabo",
    phone: "+250 788 000 111",
    verificationStatus: "verified",
  },
  {
    id: "u3",
    email: "admin@demo.rw",
    password: "demo1234",
    name: "Dr. Marie Mukamana",
    role: "admin",
    verificationStatus: "verified",
  },
];

export const RWANDA_DISTRICTS = [
  "Gasabo", "Kicukiro", "Nyarugenge",
  "Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana",
  "Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo",
  "Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro",
  "Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe", "Nyanza", "Nyaruguru", "Ruhango",
];

export type ProgramStatus = "open" | "in_progress" | "completed" | "draft";
export type ProgramCategory = "Education" | "Health" | "Environment" | "Agriculture" | "Community" | "Emergency";

export interface Program {
  id: string;
  title: string;
  description: string;
  category: ProgramCategory;
  district: string;
  sector?: string;
  startDate: string;
  endDate: string;
  slotsTotal: number;
  slotsFilled: number;
  requiredSkills: string[];
  status: ProgramStatus;
  coordinator: string;
}

export const PROGRAMS: Program[] = [
  {
    id: "p1",
    title: "Umuganda Digital Literacy Drive",
    description: "Teach basic digital skills to rural community members across sectors in Gasabo.",
    category: "Education",
    district: "Gasabo",
    sector: "Kinyinya",
    startDate: "2026-05-01",
    endDate: "2026-07-30",
    slotsTotal: 50,
    slotsFilled: 32,
    requiredSkills: ["Teaching", "Computer Literacy", "Kinyarwanda"],
    status: "open",
    coordinator: "Jean-Paul Habimana",
  },
  {
    id: "p2",
    title: "Community Health Outreach — Musanze",
    description: "Support health workers with vaccination awareness and maternal health visits.",
    category: "Health",
    district: "Musanze",
    startDate: "2026-04-15",
    endDate: "2026-06-15",
    slotsTotal: 30,
    slotsFilled: 30,
    requiredSkills: ["Healthcare", "First Aid", "Communication"],
    status: "in_progress",
    coordinator: "Jean-Paul Habimana",
  },
  {
    id: "p3",
    title: "Reforestation Initiative — Nyungwe",
    description: "Tree planting and environmental education around Nyungwe National Park.",
    category: "Environment",
    district: "Nyamasheke",
    startDate: "2026-05-10",
    endDate: "2026-08-10",
    slotsTotal: 120,
    slotsFilled: 78,
    requiredSkills: ["Physical Work", "Environmental Awareness"],
    status: "open",
    coordinator: "Jean-Paul Habimana",
  },
  {
    id: "p4",
    title: "Smart Agriculture Support — Bugesera",
    description: "Train farmers on irrigation and modern crop techniques.",
    category: "Agriculture",
    district: "Bugesera",
    startDate: "2026-06-01",
    endDate: "2026-09-01",
    slotsTotal: 40,
    slotsFilled: 12,
    requiredSkills: ["Agriculture", "Training", "Kinyarwanda"],
    status: "open",
    coordinator: "Jean-Paul Habimana",
  },
  {
    id: "p5",
    title: "Youth Empowerment Workshops — Huye",
    description: "Career guidance and entrepreneurship workshops for secondary school students.",
    category: "Community",
    district: "Huye",
    startDate: "2026-03-01",
    endDate: "2026-04-30",
    slotsTotal: 25,
    slotsFilled: 25,
    requiredSkills: ["Mentoring", "Public Speaking"],
    status: "completed",
    coordinator: "Jean-Paul Habimana",
  },
  {
    id: "p6",
    title: "Flood Response — Rubavu",
    description: "Emergency response team for flood-affected communities.",
    category: "Emergency",
    district: "Rubavu",
    startDate: "2026-04-20",
    endDate: "2026-05-20",
    slotsTotal: 60,
    slotsFilled: 45,
    requiredSkills: ["First Aid", "Logistics", "Physical Work"],
    status: "in_progress",
    coordinator: "Jean-Paul Habimana",
  },
];

export type VolunteerStatus = "pending" | "verified" | "rejected" | "suspended";

export interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string;
  district: string;
  skills: string[];
  availability: string;
  status: VolunteerStatus;
  joinedAt: string;
  hoursContributed: number;
  programsCompleted: number;
  rating: number;
}

export const VOLUNTEERS: Volunteer[] = [
  { id: "v1", name: "Aline Uwase", email: "volunteer@demo.rw", phone: "+250 788 111 222", district: "Gasabo", skills: ["Teaching", "Computer Literacy", "Kinyarwanda"], availability: "Weekends", status: "verified", joinedAt: "2026-01-12", hoursContributed: 142, programsCompleted: 3, rating: 4.8 },
  { id: "v2", name: "Eric Nshimiyimana", email: "eric@mail.rw", phone: "+250 788 222 333", district: "Musanze", skills: ["Healthcare", "First Aid"], availability: "Full-time", status: "verified", joinedAt: "2026-02-03", hoursContributed: 220, programsCompleted: 5, rating: 4.9 },
  { id: "v3", name: "Claudine Ingabire", email: "claudine@mail.rw", phone: "+250 788 333 444", district: "Bugesera", skills: ["Agriculture", "Training"], availability: "Weekdays", status: "pending", joinedAt: "2026-04-18", hoursContributed: 0, programsCompleted: 0, rating: 0 },
  { id: "v4", name: "Patrick Mugisha", email: "patrick@mail.rw", phone: "+250 788 444 555", district: "Rubavu", skills: ["Logistics", "Physical Work", "First Aid"], availability: "Full-time", status: "verified", joinedAt: "2026-01-28", hoursContributed: 305, programsCompleted: 7, rating: 4.7 },
  { id: "v5", name: "Diane Umutoni", email: "diane@mail.rw", phone: "+250 788 555 666", district: "Huye", skills: ["Mentoring", "Public Speaking"], availability: "Weekends", status: "verified", joinedAt: "2026-02-20", hoursContributed: 88, programsCompleted: 2, rating: 4.6 },
  { id: "v6", name: "Samuel Bizimana", email: "samuel@mail.rw", phone: "+250 788 666 777", district: "Nyamasheke", skills: ["Environmental Awareness", "Physical Work"], availability: "Weekends", status: "verified", joinedAt: "2026-03-05", hoursContributed: 64, programsCompleted: 1, rating: 4.5 },
  { id: "v7", name: "Grace Mutesi", email: "grace@mail.rw", phone: "+250 788 777 888", district: "Gasabo", skills: ["Teaching", "Communication"], availability: "Evenings", status: "pending", joinedAt: "2026-04-20", hoursContributed: 0, programsCompleted: 0, rating: 0 },
  { id: "v8", name: "Olivier Kagabo", email: "olivier@mail.rw", phone: "+250 788 888 999", district: "Kicukiro", skills: ["Computer Literacy", "Teaching"], availability: "Weekends", status: "verified", joinedAt: "2026-03-15", hoursContributed: 110, programsCompleted: 2, rating: 4.7 },
];

export interface Assignment {
  id: string;
  volunteerId: string;
  programId: string;
  programTitle: string;
  district: string;
  startDate: string;
  endDate: string;
  status: "active" | "completed" | "upcoming";
  hoursLogged: number;
}

export const ASSIGNMENTS: Assignment[] = [
  { id: "a1", volunteerId: "v1", programId: "p1", programTitle: "Umuganda Digital Literacy Drive", district: "Gasabo", startDate: "2026-05-01", endDate: "2026-07-30", status: "active", hoursLogged: 32 },
  { id: "a2", volunteerId: "v1", programId: "p5", programTitle: "Youth Empowerment Workshops — Huye", district: "Huye", startDate: "2026-03-01", endDate: "2026-04-30", status: "completed", hoursLogged: 48 },
];

export interface ActivityLog {
  id: string;
  volunteerId: string;
  programId: string;
  date: string;
  hours: number;
  description: string;
  status: "pending" | "approved" | "rejected";
}

export const ACTIVITY_LOGS: ActivityLog[] = [
  { id: "l1", volunteerId: "v1", programId: "p1", date: "2026-04-25", hours: 4, description: "Taught 12 community members basic Excel and Word.", status: "approved" },
  { id: "l2", volunteerId: "v1", programId: "p1", date: "2026-04-22", hours: 5, description: "Organized enrollment of new learners for digital literacy class.", status: "approved" },
  { id: "l3", volunteerId: "v1", programId: "p1", date: "2026-04-26", hours: 3, description: "Follow-up session with previous learners.", status: "pending" },
];

// Analytics
export const MONTHLY_PARTICIPATION = [
  { month: "Jan", volunteers: 210, hours: 2400 },
  { month: "Feb", volunteers: 340, hours: 3800 },
  { month: "Mar", volunteers: 420, hours: 5200 },
  { month: "Apr", volunteers: 580, hours: 7100 },
  { month: "May", volunteers: 640, hours: 8600 },
  { month: "Jun", volunteers: 720, hours: 9800 },
];

export const DISTRICT_PARTICIPATION = [
  { district: "Gasabo", volunteers: 320 },
  { district: "Musanze", volunteers: 210 },
  { district: "Rubavu", volunteers: 185 },
  { district: "Huye", volunteers: 160 },
  { district: "Nyamasheke", volunteers: 145 },
  { district: "Bugesera", volunteers: 120 },
  { district: "Kicukiro", volunteers: 118 },
  { district: "Kirehe", volunteers: 95 },
];

export const CATEGORY_DISTRIBUTION = [
  { name: "Education", value: 32 },
  { name: "Health", value: 24 },
  { name: "Environment", value: 18 },
  { name: "Agriculture", value: 12 },
  { name: "Community", value: 9 },
  { name: "Emergency", value: 5 },
];

export const NATIONAL_KPIS = {
  totalVolunteers: 2840,
  activeVolunteers: 1920,
  totalPrograms: 86,
  activePrograms: 34,
  totalHours: 48600,
  districtsCovered: 28,
};

// AI smart-match mock results
export const SMART_MATCHES = [
  { volunteerId: "v1", score: 94, reason: "Strong match on Teaching & Computer Literacy; based in Gasabo (program district)." },
  { volunteerId: "v8", score: 89, reason: "Matches Teaching & Computer Literacy; available weekends as required." },
  { volunteerId: "v5", score: 72, reason: "Good communication & mentoring skills; district is different but can travel." },
];

export const AI_REPORT_SUMMARY = `National volunteer engagement grew **+38%** this quarter, driven mainly by expansion in Gasabo, Musanze, and Rubavu. Education remains the top category (32% of all deployments), followed by Health (24%). Emergency response activities peaked in April due to flood response in Rubavu.

**Key insights:**
- Volunteer retention is strongest (87%) in Health programs.
- The Agriculture module is under-subscribed — only 30% of slots filled in Bugesera.
- Recommend reallocating outreach budget toward Southern Province to balance district coverage.
- 142 volunteers pending verification — average wait time 6.2 days (target: 3 days).`;
