import Link from "next/link";
import AuthButton from "@/components/AuthButton";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="text-lg font-bold text-emerald-800">
          🌲 綠鏈林匯
        </Link>
        <Link href="/draw" className="text-sm text-stone-600 hover:text-emerald-700">
          林區建檔
        </Link>
        <Link href="/dashboard" className="text-sm text-stone-600 hover:text-emerald-700">
          儀表板
        </Link>
        <div className="ml-auto">
          <AuthButton />
        </div>
      </nav>
    </header>
  );
}
