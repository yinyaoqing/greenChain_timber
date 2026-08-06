"use client";

import Link from "next/link";

export default function AuthButton() {
  return (
    <Link
      href="/login"
      className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800"
    >
      登入
    </Link>
  );
}
