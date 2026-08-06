import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl">🌲</p>
      <h1 className="mt-4 text-2xl font-bold text-emerald-900">找不到這片森林</h1>
      <p className="mt-2 text-stone-600">頁面不存在或已被移除。</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-emerald-700 px-6 py-2.5 text-white hover:bg-emerald-800"
      >
        回首頁
      </Link>
    </div>
  );
}
