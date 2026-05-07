import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import nvmsLogo from "@/assets/nvms-logo.png";

interface LogoProps {
  className?: string;
  variant?: "default" | "light";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className, variant = "default", size = "md", showText = true }: LogoProps) {
  const { t } = useTranslation();
  const dim = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const titleSz = size === "lg" ? "text-lg" : "text-sm";
  return (
    <Link to="/" className={cn("flex items-center gap-2.5 font-display font-bold", className)} aria-label="NVMS Rwanda — home">
      <img
        src={nvmsLogo}
        alt="NVMS Rwanda volunteer emblem"
        className={cn(dim, "shrink-0 object-contain")}
        width={48}
        height={48}
      />
      {showText && (
        <span className="flex flex-col leading-tight">
          <span className={cn(titleSz, variant === "light" ? "text-white" : "text-foreground")}>NVMS Rwanda</span>
          <span className={cn("text-[10px] font-medium uppercase tracking-wider", variant === "light" ? "text-white/70" : "text-muted-foreground")}>
            MINALOC · {t("site.republic")}
          </span>
        </span>
      )}
    </Link>
  );
}
