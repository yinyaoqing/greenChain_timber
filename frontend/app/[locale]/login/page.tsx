"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { safeReturnTo } from "@/lib/authRedirect";

function LoginForm() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("auth");
  // 登入後的去向：AuthGuard 導過來時帶的 returnTo，否則回儀表板
  const destination = safeReturnTo(useSearchParams().get("returnTo")) ?? "/dashboard";

  useEffect(() => {
    if (!sessionLoading && session) router.replace(destination);
  }, [sessionLoading, session, router, destination]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.replace(destination);
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data.session) {
      setError(null);
      setInfo(t("signupSuccess"));
      return;
    }
    router.replace(destination);
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-xl border border-stone-200 bg-white p-8">
      <h1 className="text-xl font-bold text-emerald-900">
        {mode === "signin" ? t("login") : t("signup")}
      </h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-md border border-stone-300 px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          className="w-full rounded-md border border-stone-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-emerald-600">{info}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-emerald-700 py-2 text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? t("processing") : mode === "signin" ? t("login") : t("signup")}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-4 text-sm text-emerald-700 underline"
      >
        {mode === "signin" ? t("toSignup") : t("toSignin")}
      </button>
    </div>
  );
}

export default function LoginPage() {
  const tc = useTranslations("common");
  return (
    <Suspense
      fallback={<div className="flex h-64 items-center justify-center text-stone-500">{tc("loading")}</div>}
    >
      <LoginForm />
    </Suspense>
  );
}
