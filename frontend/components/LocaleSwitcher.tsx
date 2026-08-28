"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("header");
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === "zh-TW" ? "en" : "zh-TW";

  return (
    <button
      onClick={() => router.replace(pathname, { locale: other })}
      className="rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100"
      aria-label="Switch language"
    >
      {t("localeSwitch")}
    </button>
  );
}
