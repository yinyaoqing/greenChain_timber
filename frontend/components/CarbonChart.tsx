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
import type { YearEstimate } from "@/lib/types";

export default function CarbonChart({ estimates }: { estimates: YearEstimate[] }) {
  const baseYear = new Date().getFullYear();
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
            label={{ value: "噸 CO₂e/年", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip formatter={(v) => (typeof v === 'number' ? [`${v.toFixed(4)} 噸 CO₂e`, "年固碳量"] : ["", ""])} />
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
