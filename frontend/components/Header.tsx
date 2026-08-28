import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import AuthButton from "@/components/AuthButton";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default function Header() {
  const t = useTranslations("header");
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="text-lg font-bold text-emerald-800">
          {t("brand")}
        </Link>
        <Link href="/draw" className="text-sm text-stone-600 hover:text-emerald-700">
          {t("draw")}
        </Link>
        <Link href="/dashboard" className="text-sm text-stone-600 hover:text-emerald-700">
          {t("dashboard")}
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitcher />
          <AuthButton />
        </div>
      </nav>
    </header>
  );
}
