import { useTranslation } from "react-i18next";
import rwandaCoa from "@/assets/rwanda-coat-of-arms.png";

/**
 * Slim official government bar shown above the main header,
 * mimicking the style of real Rwandan government portals (gov.rw).
 */
export function GovernmentBar() {
  const { t } = useTranslation();
  return (
    <div className="w-full border-b border-border/60 bg-primary text-primary-foreground">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide">
          <img
            src={rwandaCoa}
            alt="Republic of Rwanda coat of arms"
            className="h-6 w-6 object-contain"
            width={24}
            height={24}
          />
          <span className="hidden sm:inline">{t("site.republic")} · {t("site.ministry")}</span>
          <span className="sm:hidden">Republic of Rwanda</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="hidden md:inline opacity-80">An official Government of Rwanda platform</span>
          <span className="inline-flex h-2 w-2 rounded-full bg-success" aria-hidden />
          <span className="opacity-90">Secure · gov.rw</span>
        </div>
      </div>
    </div>
  );
}
