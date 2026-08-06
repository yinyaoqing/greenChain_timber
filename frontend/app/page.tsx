import Link from "next/link";

const STEPS = [
  { icon: "🗺️", title: "圈選林地", desc: "3D 衛星地圖上逐點圈出林區邊界" },
  { icon: "🧮", title: "自動估算", desc: "農業部公式估算當年與未來 5 年固碳量" },
  { icon: "⛓️", title: "上鏈存證", desc: "幾何指紋與碳噸數鑄造 NFT，防重複申報" },
  { icon: "📊", title: "透明驗證", desc: "企業儀表板檢視曲線與鏈上交易紀錄" },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold text-emerald-900">
          讓每一片森林的碳匯，都可量測、可驗證、不可竄改
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-stone-600">
          綠鏈林匯是數位 MRV 碳權透明化平台：地圖圈選林地、空間防重疊檢查、
          固碳量自動估算、區塊鏈存證，一站完成。
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/draw"
            className="rounded-lg bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800"
          >
            開始圈地申報
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-emerald-700 px-6 py-3 font-medium text-emerald-700 hover:bg-emerald-50"
          >
            瀏覽企業儀表板
          </Link>
        </div>
      </section>
      <section className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-xl border border-stone-200 bg-white p-6">
            <div className="text-3xl">{s.icon}</div>
            <h3 className="mt-3 font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-stone-600">{s.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
