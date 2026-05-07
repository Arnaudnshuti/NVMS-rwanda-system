import { Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";

import HomePage from "@/pages/index";
import AboutPage from "@/pages/about";
import ProgramsPage from "@/pages/programs";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";

import VolunteerIndex from "@/pages/volunteer.index";
import VolunteerActivity from "@/pages/volunteer.activity";
import VolunteerAssignments from "@/pages/volunteer.assignments";
import VolunteerCertificates from "@/pages/volunteer.certificates";
import VolunteerProfile from "@/pages/volunteer.profile";
import VolunteerPrograms from "@/pages/volunteer.programs";
import VolunteerTrustProfile from "@/pages/volunteer.trust-profile";
import VolunteerApplications from "@/pages/volunteer.applications";

import CoordinatorIndex from "@/pages/coordinator.index";
import CoordinatorDeployments from "@/pages/coordinator.deployments";
import CoordinatorPrograms from "@/pages/coordinator.programs";
import CoordinatorSmartMatch from "@/pages/coordinator.smart-match";
import CoordinatorVolunteers from "@/pages/coordinator.volunteers";
import CoordinatorMessages from "@/pages/coordinator.messages";
import CoordinatorReports from "@/pages/coordinator.reports";
import CoordinatorApplications from "@/pages/coordinator.applications";
import CoordinatorResources from "@/pages/coordinator.resources";

import AdminIndex from "@/pages/admin.index";
import AdminAnalytics from "@/pages/admin.analytics";
import AdminDistricts from "@/pages/admin.districts";
import AdminPrograms from "@/pages/admin.programs";
import AdminReports from "@/pages/admin.reports";
import AdminSettings from "@/pages/admin.settings";
import AdminUsers from "@/pages/admin.users";
import AdminInvites from "@/pages/admin.invites";
import AdminAudit from "@/pages/admin.audit";
import ForgotPasswordPage from "@/pages/forgot-password";
import VerifyEmailPage from "@/pages/verify-email";
import NotificationsPage from "@/pages/notifications";
import ChangePasswordPage from "@/pages/change-password";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/programs" element={<ProgramsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          <Route path="/volunteer" element={<VolunteerIndex />} />
          <Route path="/volunteer/activity" element={<VolunteerActivity />} />
          <Route path="/volunteer/assignments" element={<VolunteerAssignments />} />
          <Route path="/volunteer/certificates" element={<VolunteerCertificates />} />
          <Route path="/volunteer/profile" element={<VolunteerProfile />} />
          <Route path="/volunteer/programs" element={<VolunteerPrograms />} />
          <Route path="/volunteer/trust-profile" element={<VolunteerTrustProfile />} />
          <Route path="/volunteer/applications" element={<VolunteerApplications />} />

          <Route path="/coordinator" element={<CoordinatorIndex />} />
          <Route path="/coordinator/deployments" element={<CoordinatorDeployments />} />
          <Route path="/coordinator/programs" element={<CoordinatorPrograms />} />
          <Route path="/coordinator/smart-match" element={<CoordinatorSmartMatch />} />
          <Route path="/coordinator/volunteers" element={<CoordinatorVolunteers />} />
          <Route path="/coordinator/messages" element={<CoordinatorMessages />} />
          <Route path="/coordinator/reports" element={<CoordinatorReports />} />
          <Route path="/coordinator/applications" element={<CoordinatorApplications />} />
          <Route path="/coordinator/resources" element={<CoordinatorResources />} />

          <Route path="/admin" element={<AdminIndex />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/districts" element={<AdminDistricts />} />
          <Route path="/admin/programs" element={<AdminPrograms />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/invites" element={<AdminInvites />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}
