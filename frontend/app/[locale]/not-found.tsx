import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl">🌲</p>
      <h1 className="mt-4 text-2xl font-bold text-emerald-900">{t("title")}</h1>
      <p className="mt-2 text-stone-600">{t("desc")}</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-emerald-700 px-6 py-2.5 text-white hover:bg-emerald-800"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
