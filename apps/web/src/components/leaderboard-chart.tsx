"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ChartRow {
  name: string;
  value: number;
  sublabel: string;
}

export function LeaderboardChart({ data, color, unit }: { data: ChartRow[]; color: string; unit: string }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No confirmed results yet.
      </div>
    );
  }

  const chartData = [...data].reverse();

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 34)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            color: "var(--popover-foreground)",
            fontSize: 12,
          }}
          formatter={(value, _name, item) => [`${value} ${unit}`, (item.payload as ChartRow).sublabel]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {chartData.map((row, i) => (
            <Cell key={`${row.name}-${i}`} fill={i === chartData.length - 1 ? "var(--brand-yellow)" : color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            style={{ fill: "var(--foreground)", fontSize: 12, fontVariantNumeric: "tabular-nums" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
