import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../shared/components/ui";

const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export interface ReportChartFromSpecProps {
  chartSpec: Record<string, unknown>;
  rows: Record<string, unknown>[];
  columns: string[];
}

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Renders chart/table from backend chart_spec + execute rows (bar | line | pie | kpi_grid).
 */
export function ReportChartFromSpec({ chartSpec, rows, columns }: ReportChartFromSpecProps) {
  const { t } = useTranslation("reports");
  const chartType = String(chartSpec.chartType ?? "table").toLowerCase();

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">{t("chart.empty")}</p>
    );
  }

  if (chartType === "kpi_grid") {
    const fields = (chartSpec.fields as string[] | undefined) ?? columns;
    const row0 = rows[0] ?? {};
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((key) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wide">{key}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{asString(row0[key])}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (chartType === "pie") {
    const labelKey = String(chartSpec.labelKey ?? chartSpec.xKey ?? columns[0] ?? "label");
    const yKeysPie = Array.isArray(chartSpec.yKeys) ? (chartSpec.yKeys as string[]) : [];
    const valueKey = String(chartSpec.valueKey ?? yKeysPie[0] ?? columns[1] ?? "value");
    const data = rows.map((r) => ({
      name: asString(r[labelKey]),
      value: asNumber(r[valueKey]),
    }));
    return (
      <div className="h-[320px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {data.map((_, i) => (
                <Cell key={String(i)} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "line" || chartType === "bar") {
    const xKey = String(chartSpec.xKey ?? columns[0] ?? "x");
    const yKeys =
      (Array.isArray(chartSpec.yKeys) ? (chartSpec.yKeys as string[]) : undefined) ??
      columns.filter((c) => c !== xKey).slice(0, 3);
    const data = rows.map((r) => {
      const point: Record<string, unknown> = { [xKey]: r[xKey] };
      for (const y of yKeys) {
        point[y] = asNumber(r[y]);
      }
      return point;
    });
    const Chart = chartType === "line" ? LineChart : BarChart;
    return (
      <div className="h-[320px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <Tooltip />
            <Legend />
            {yKeys.map((y, i) =>
              chartType === "line" ? (
                <Line key={y} type="monotone" dataKey={y} stroke={PIE_COLORS[i % PIE_COLORS.length]} dot={false} />
              ) : (
                <Bar key={y} dataKey={y} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 tabular-nums">
                  {asString(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
