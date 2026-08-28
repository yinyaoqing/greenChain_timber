"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import type { YearEstimate } from "@/lib/types";

/** baseYear 以林區建檔時間（created_at）為準，估算曲線才不會隨瀏覽當下的年份漂移 */
export default function CarbonChart({
  estimates,
  createdAt,
}: {
  estimates: YearEstimate[];
  createdAt?: string;
}) {
  const t = useTranslations("chart");
  const parsed = createdAt ? new Date(createdAt) : null;
  const baseYear =
    parsed && !Number.isNaN(parsed.getTime())
      ? parsed.getFullYear()
      : new Date().getFullYear();
  const data = [...estimates]
    .sort((a, b) => a.year_offset - b.year_offset)
    .map((e) => ({ year: `${baseYear + e.year_offset}`, co2e: e.co2e_tons }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{ value: t("yAxis"), angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip
            formatter={(v) =>
              typeof v === "number"
                ? [t("tooltipValue", { value: v.toFixed(4) }), t("tooltipLabel")]
                : ["", ""]
            }
          />
          <Line
            type="monotone"
            dataKey="co2e"
            stroke="#047857"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
