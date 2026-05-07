import { Link, NavLink } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors hover:text-foreground ${isActive ? "text-foreground" : "text-muted-foreground"}`;
import { useTranslation } from "react-i18next";
import { Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { GovernmentBar } from "./GovernmentBar";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth";
import rwandaCoa from "@/assets/rwanda-coat-of-arms.png";

export function SiteHeader() {
  const { user } = useAuth();
  const { t } = useTranslation();
  return (
    <>
      <GovernmentBar />
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            <NavLink to="/" end className={navLinkClass}>{t("nav.home")}</NavLink>
            <NavLink to="/about" className={navLinkClass}>{t("nav.about")}</NavLink>
            <NavLink to="/programs" className={navLinkClass}>{t("nav.programs")}</NavLink>
          </nav>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">{t("common.signIn")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">{t("common.register")}</Link>
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">{t("site.footerTagline")}</p>
            <div className="mt-5 flex items-center gap-3">
              <img src={rwandaCoa} alt="Republic of Rwanda" className="h-12 w-12 object-contain" width={48} height={48} loading="lazy" />
              <div className="text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">{t("site.republic")}</div>
                <div>{t("site.ministry")}</div>
              </div>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">{t("site.platform")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground">{t("nav.about")}</Link></li>
              <li><Link to="/programs" className="hover:text-foreground">{t("nav.programs")}</Link></li>
              <li><Link to="/register" className="hover:text-foreground">{t("common.register")}</Link></li>
              <li><Link to="/login" className="hover:text-foreground">{t("common.signIn")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">{t("site.government")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Kigali, Rwanda</li>
              <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> +250 788 000 000</li>
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> info@minaloc.gov.rw</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} NVMS Rwanda · MINALOC. All rights reserved.</span>
          <span className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" /> All systems operational</span>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Accessibility</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
