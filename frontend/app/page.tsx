import Link from "next/link";

const STEPS = [
  { icon: "🗺️", title: "林區數位建檔", desc: "3D 衛星地圖上逐點圈繪林區邊界，幾何自動正規化" },
  { icon: "🛡️", title: "空間防重疊查核", desc: "PostGIS 即時比對既有林區，重疊區塊當場紅色標示" },
  { icon: "🧮", title: "官方公式估算", desc: "依環境部方法學架構與農業部係數估算當年與未來 5 年固碳量" },
  { icon: "⛓️", title: "存證與公開查驗", desc: "幾何指紋與碳噸數上鏈，任何人可自行重算比對" },
];

const AUDIENCES = [
  {
    title: "企業永續部門",
    desc: "認養林地與造林專案的持續監測儀表板；每個數字附公式版本與鏈上交易連結，供永續報告書與查驗機構自行核對。",
  },
  {
    title: "環境顧問與盡職調查",
    desc: "出資或採購前的空間查核：邊界是否重疊、面積是否屬實、方法學與係數版本是否揭露完整。",
  },
  {
    title: "聚合單位與保育組織",
    desc: "產銷班、合作社、公協會聚合多位林主時的空間治理底層——邊界互不侵犯、貢獻比例可計算可存證。",
  },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="text-center">
        <p className="text-sm font-medium tracking-wide text-emerald-700">
          森林碳匯數位 MRV 監測與存證平台
        </p>
        <h1 className="mt-3 text-4xl font-bold text-emerald-900">
          讓每一筆森林碳匯數據，都可量測、可驗證、不可竄改
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-stone-600">
          綠鏈林匯把林區邊界、固碳估算與存證紀錄，變成任何第三方都能自行核對的資料——
          服務對象是企業、顧問與聚合單位，我們提供的是數據信任基礎設施。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800"
          >
            檢視示範林區儀表板
          </Link>
          <Link
            href="/draw"
            className="rounded-lg border border-emerald-700 px-6 py-3 font-medium text-emerald-700 hover:bg-emerald-50"
          >
            林區數位建檔
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

      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold text-emerald-900">誰在使用</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="font-semibold text-stone-800">{a.title}</h3>
              <p className="mt-2 text-sm text-stone-600">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-900">我們不做什麼（定位與界線）</h2>
        <ul className="mt-3 space-y-2 text-sm text-amber-900/90">
          <li>
            <strong>碳匯 ≠ 碳權。</strong>
            本平台呈現的是碳儲存與固碳量的量測與監測數據，估算值不等於、也不構成經查證之減量額度。
          </li>
          <li>
            <strong>天然林不談變現。</strong>
            對天然林與次生林場景，本平台僅提供碳儲存監測與生態價值展示，不涉及任何碳權變現主張。
          </li>
          <li>
            <strong>不碰額度交易。</strong>
            減量額度之買賣屬主管機關規範之交易行為；本平台不參與額度交易之撮合與抽成，只就額度產生前的數據信任服務收費。
          </li>
          <li>
            <strong>申請資格如實揭露。</strong>
            我國自願減量專案之申請人限事業、各級政府與公協會等機構，個人不得逕行申請；小林主須經聚合單位參與——本平台定位為企業與聚合單位的數據底層，而非個人變現管道。
          </li>
        </ul>
      </section>
    </div>
  );
}
