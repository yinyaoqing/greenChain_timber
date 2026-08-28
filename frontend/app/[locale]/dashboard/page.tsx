"use client";

import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import AuthGuard from "@/components/AuthGuard";
import StatusBadge from "@/components/StatusBadge";
import { UnauthorizedError, listForest } from "@/lib/api";
import { loginHref } from "@/lib/authRedirect";
import type { PlotListItem } from "@/lib/types";
import { formatHa } from "@/lib/format";

function PlotCards() {
  const [plots, setPlots] = useState<PlotListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const ts = useTranslations("species");
  const tf = useTranslations("format");
  const locale = useLocale();

  useEffect(() => {
    listForest()
      .then(setPlots)
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) {
          router.replace(loginHref("/dashboard"));
          return;
        }
        setError(e instanceof Error ? e.message : tc("loadFailed"));
      });
  }, [router, tc]);

  if (error) return <p className="text-red-600">{t("loadFailedWith", { message: error })}</p>;
  if (plots === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-xl border border-stone-200 bg-stone-100"
          />
        ))}
      </div>
    );
  }
  if (plots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 p-12 text-center">
        <p className="text-stone-500">{t("empty")}</p>
        <Link href="/draw" className="mt-2 inline-block text-emerald-700 underline">
          {t("emptyCta")}
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plots.map((p) => (
        <Link
          key={p.id}
          href={`/dashboard/${p.id}`}
          className="rounded-xl border border-stone-200 bg-white p-5 transition hover:border-emerald-400 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-stone-800">{p.name}</h3>
            <StatusBadge status={p.status} />
          </div>
          <dl className="mt-3 space-y-1 text-sm text-stone-600">
            <div className="flex justify-between">
              <dt>{t("species")}</dt>
              <dd>{ts(p.species)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("area")}</dt>
              <dd>{formatHa(p.area_ha, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("co2eCurrent")}</dt>
              <dd className="font-medium text-emerald-700">
                {p.co2e_current !== null
                  ? tf("co2ePerYear", {
                      value: p.co2e_current.toLocaleString(locale, { maximumFractionDigits: 2 }),
                    })
                  : "—"}
              </dd>
            </div>
          </dl>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  return (
    <AuthGuard>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-emerald-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("subtitle")}</p>
        <div className="mt-6">
          <PlotCards />
        </div>
      </div>
    </AuthGuard>
  );
}
