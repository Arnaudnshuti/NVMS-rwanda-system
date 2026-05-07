import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, User, Briefcase, ClipboardList, Award, LogOut,
  Users, MapPin, BarChart3, Settings, Sparkles, CheckCircle2, Search, Building2, HeartHandshake, FileCheck2, Bell, Send, Inbox, FileText, ScrollText,
  Truck,
} from "lucide-react";
import { useAuth, dashboardPathFor } from "@/lib/auth";
import type { UserRole } from "@/lib/mock-data";
import { canAccessPortal, resolveProfileTrustStatus } from "@/lib/portal-access";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type NavItem = { to: string; labelKey: string; icon: typeof LayoutDashboard };

const NAV: Record<UserRole, NavItem[]> = {
  volunteer: [
    { to: "/volunteer", labelKey: "portal.dashboard", icon: LayoutDashboard },
    { to: "/volunteer/profile", labelKey: "portal.myProfile", icon: User },
    { to: "/volunteer/trust-profile", labelKey: "portal.trustProfile", icon: FileCheck2 },
    { to: "/volunteer/programs", labelKey: "portal.browsePrograms", icon: Briefcase },
    { to: "/volunteer/applications", labelKey: "portal.myApplications", icon: Inbox },
    { to: "/volunteer/assignments", labelKey: "portal.myAssignments", icon: CheckCircle2 },
    { to: "/volunteer/activity", labelKey: "portal.activityLog", icon: ClipboardList },
    { to: "/volunteer/certificates", labelKey: "portal.certificates", icon: Award },
    { to: "/notifications", labelKey: "common.notifications", icon: Bell },
  ],
  coordinator: [
    { to: "/coordinator", labelKey: "portal.dashboard", icon: LayoutDashboard },
    { to: "/coordinator/programs", labelKey: "portal.programs", icon: Briefcase },
    { to: "/coordinator/volunteers", labelKey: "portal.volunteers", icon: Users },
    { to: "/coordinator/applications", labelKey: "portal.programApplications", icon: Inbox },
    { to: "/coordinator/reports", labelKey: "portal.fieldReports", icon: FileText },
    { to: "/coordinator/deployments", labelKey: "portal.deployments", icon: MapPin },
    { to: "/coordinator/smart-match", labelKey: "portal.smartMatch", icon: Sparkles },
    { to: "/coordinator/resources", labelKey: "portal.resources", icon: Truck },
    { to: "/coordinator/messages", labelKey: "portal.messages", icon: Send },
    { to: "/notifications", labelKey: "common.notifications", icon: Bell },
  ],
  admin: [
    { to: "/admin", labelKey: "portal.nationalOverview", icon: LayoutDashboard },
    { to: "/admin/analytics", labelKey: "portal.analytics", icon: BarChart3 },
    { to: "/admin/districts", labelKey: "portal.districts", icon: MapPin },
    { to: "/admin/users", labelKey: "portal.usersRoles", icon: Users },
    { to: "/admin/audit", labelKey: "portal.auditLog", icon: ScrollText },
    { to: "/admin/invites", labelKey: "portal.userInvites", icon: User },
    { to: "/volunteer", labelKey: "portal.volunteerWorkspace", icon: HeartHandshake },
    { to: "/coordinator", labelKey: "portal.coordinatorWorkspace", icon: Building2 },
    { to: "/admin/programs", labelKey: "portal.programs", icon: Briefcase },
    { to: "/admin/reports", labelKey: "portal.aiReports", icon: Sparkles },
    { to: "/admin/settings", labelKey: "common.settings", icon: Settings },
    { to: "/notifications", labelKey: "common.notifications", icon: Bell },
  ],
};

interface PortalShellProps {
  role: UserRole;
  children: ReactNode;
}

export function PortalShell({ role, children }: PortalShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.mustChangePassword) {
      navigate("/change-password");
      return;
    }
    if (!canAccessPortal(user, role)) {
      navigate(dashboardPathFor(user.role));
    }
  }, [user, role, navigate]);

  if (!user || !canAccessPortal(user, role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const items = NAV[role];
  const roleLabel = t(`portal.${role}`);

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Logo variant="light" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Sidebar">
          {items.map((item) => {
            const active =
              item.to === "/coordinator"
                ? location.pathname.startsWith("/coordinator")
                : item.to === "/volunteer"
                  ? location.pathname === "/volunteer"
                  : location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-sidebar-foreground/60">{roleLabel}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { logout(); navigate("/"); }}
              className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label={t("common.signOut")}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <Logo size="sm" showText={false} />
          </div>
          <div className="hidden md:block">
            <h1 className="font-display text-lg font-semibold text-foreground">{roleLabel} {t("portal.portalSuffix")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("site.ministry")} · {t("site.republic")}
              {user.role === "coordinator" && user.district && (
                <>
                  {" · "}
                  <span className="font-medium text-foreground">District office: {user.district}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("common.search")}
                className="h-9 w-56 pl-8"
                aria-label={t("common.search")}
              />
            </div>
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationBell />
            <Button
              variant="outline"
              size="sm"
              className="hidden lg:inline-flex"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              {t("common.signOut")}
            </Button>
          </div>
        </header>
        <main id="main" className="flex-1 space-y-4 p-4 sm:p-6 lg:p-8">
          {role === "volunteer" && user.role === "volunteer" && user.verificationStatus === "rejected" && (
            <Alert variant="destructive">
              <AlertTitle>Registration not approved</AlertTitle>
              <AlertDescription>
                Your volunteer profile was not approved at district level. Contact your coordinator or MINALOC for more information.
              </AlertDescription>
            </Alert>
          )}
          {role === "volunteer" && user.role === "volunteer" && user.verificationStatus === "pending" && (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTitle>Profile pending verification</AlertTitle>
              <AlertDescription>
                Your registration is reviewed by a coordinator in your selected district. Sign in again after approval. Applications stay disabled until your account is verified. You will receive an email or SMS when approved (once messaging is connected).
              </AlertDescription>
            </Alert>
          )}
          {role === "volunteer" && user.role === "volunteer" && user.verificationStatus === "verified" && resolveProfileTrustStatus(user) === "unsubmitted" && (
            <Alert className="border-primary/30 bg-primary/5">
              <AlertTitle>Complete trusted identity (KYC)</AlertTitle>
              <AlertDescription>
                Your account is approved. Submit national ID, photo, skills, and emergency contact so a coordinator can mark you as a <strong>trusted volunteer</strong>. Until then you cannot apply to programs.{" "}
                <Link to="/volunteer/trust-profile" className="font-semibold text-primary underline">Go to identity &amp; documents</Link>
              </AlertDescription>
            </Alert>
          )}
          {role === "volunteer" && user.role === "volunteer" && user.verificationStatus === "verified" && resolveProfileTrustStatus(user) === "pending_review" && (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTitle>Documents under review</AlertTitle>
              <AlertDescription>
                Your trusted profile has been submitted. A coordinator in your district will review it. Program applications stay disabled until you receive the trusted volunteer badge.
              </AlertDescription>
            </Alert>
          )}
          {role === "volunteer" && user.role === "volunteer" && user.verificationStatus === "verified" && resolveProfileTrustStatus(user) === "rejected" && (
            <Alert variant="destructive">
              <AlertTitle>Trusted profile not approved</AlertTitle>
              <AlertDescription>
                Your identity documents were not approved. Update your submission or contact your district coordinator.{" "}
                <Link to="/volunteer/trust-profile" className="font-semibold underline">Update submission</Link>
              </AlertDescription>
            </Alert>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
