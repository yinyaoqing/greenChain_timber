"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";

export default function AuthButton() {
  const { session, loading } = useSession();
  const router = useRouter();

  if (loading) return <span className="text-sm text-stone-400">…</span>;

  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800"
      >
        登入
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
        登出
      </button>
    </div>
  );
}
