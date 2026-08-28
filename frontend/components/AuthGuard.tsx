"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSession } from "@/hooks/useSession";
import { loginHref } from "@/lib/authRedirect";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");

  useEffect(() => {
    if (loading || session) return;
    router.replace(loginHref(pathname + window.location.search));
  }, [loading, session, router, pathname]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-stone-500">{t("loading")}</div>;
  }
  if (!session) return null;
  return <>{children}</>;
}
