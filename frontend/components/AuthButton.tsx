"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";

export default function AuthButton() {
  const { session, loading } = useSession();
  const router = useRouter();
  const t = useTranslations("auth");

  if (loading) return <span className="text-sm text-stone-400">…</span>;

  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800"
      >
        {t("login")}
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs text-stone-500 sm:inline">{session.user.email}</span>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace("/");
        }}
        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
      >
        {t("logout")}
      </button>
    </div>
  );
}
