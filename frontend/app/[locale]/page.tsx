import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const STEP_ICONS = ["🗺️", "🛡️", "🧮", "⛓️"] as const;
const STEP_KEYS = ["s1", "s2", "s3", "s4"] as const;
const AUDIENCE_KEYS = ["a1", "a2", "a3"] as const;
const BOUNDARY_KEYS = ["b1", "b2", "b3", "b4"] as const;

export default function LandingPage() {
  const t = useTranslations("home");
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="text-center">
        <p className="text-sm font-medium tracking-wide text-emerald-700">{t("tagline")}</p>
        <h1 className="mt-3 text-4xl font-bold text-emerald-900">{t("title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-stone-600">{t("intro")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/dashboard" className="rounded-lg bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800">
            {t("ctaDashboard")}
          </Link>
          <Link href="/draw" className="rounded-lg border border-emerald-700 px-6 py-3 font-medium text-emerald-700 hover:bg-emerald-50">
            {t("ctaDraw")}
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEP_KEYS.map((k, i) => (
          <div key={k} className="rounded-xl border border-stone-200 bg-white p-6">
            <div className="text-3xl">{STEP_ICONS[i]}</div>
            <h3 className="mt-3 font-semibold">{t(`steps.${k}.title`)}</h3>
            <p className="mt-1 text-sm text-stone-600">{t(`steps.${k}.desc`)}</p>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold text-emerald-900">{t("audiencesTitle")}</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {AUDIENCE_KEYS.map((k) => (
            <div key={k} className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="font-semibold text-stone-800">{t(`audiences.${k}.title`)}</h3>
              <p className="mt-2 text-sm text-stone-600">{t(`audiences.${k}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-900">{t("boundaries.title")}</h2>
        <ul className="mt-3 space-y-2 text-sm text-amber-900/90">
          {BOUNDARY_KEYS.map((k) => (
            <li key={k}>
              <strong>{t(`boundaries.${k}Strong`)}</strong>
              {t(`boundaries.${k}`)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
