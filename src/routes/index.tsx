import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Bus, Coins, Users, Wrench, FileWarning } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatCard, StatusPill } from "@/components/ui-kit";
import { alerts, buses, currency, fuelChart, monthlyFinance, students } from "@/lib/fleet-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكّم | وليد وطلعت لإدارة الأسطول" },
      {
        name: "description",
        content: "لوحة تحكم تنفيذية لإدارة أسطول الأتوبيسات والسائقين والاشتراكات والمالية لشركة وليد وطلعت.",
      },
      { property: "og:title", content: "لوحة التحكّم | وليد وطلعت لإدارة الأسطول" },
      {
        property: "og:description",
        content: "متابعة لحظية للأتوبيسات والإيرادات والصيانة والتنبيهات العاجلة.",
      },
    ],
  }),
  component: Dashboard,
});

const tooltipStyle = {
  background: "oklch(0.22 0.055 266)",
  border: "1px solid oklch(0.79 0.135 88 / 40%)",
  borderRadius: 12,
  color: "#fff",
  fontFamily: "Cairo, sans-serif",
};

function Dashboard() {
  const working = buses.filter((b) => b.status === "تعمل").length;
  const inShop = buses.filter((b) => b.status === "بالورشة").length;
  const stopped = buses.filter((b) => b.status === "متوقفة").length;
  const late = students.filter((s) => s.status === "متأخر").length;

  return (
    <AppShell>
      <PageHeader
        title="لوحة التحكّم التنفيذية"
        subtitle="نظرة شاملة على أداء الأسطول والتشغيل والمالية — تحديث اليوم ١٠ سبتمبر ٢٠٢٦"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إجمالي الأتوبيسات"
          value={`${buses.length} أتوبيس`}
          hint={`${working} تعمل • ${inShop} بالورشة • ${stopped} معطلة`}
          icon={Bus}
        />
        <StatCard label="الإيرادات والمقبوضات اليومية" value={currency(62450)} hint="مقبوضات نقدية وتحويلات اليوم" icon={Coins} />
        <StatCard label="إجمالي الطلاب والمشتركين" value={`${students.length * 42} مشترك`} hint={`${late} حالات سداد متأخرة`} icon={Users} />
        <StatCard label="التنبيهات العاجلة" value={`${alerts.filter((a) => a.level === "عاجل").length} تنبيهات`} hint="عقود وتراخيص ومخزون" icon={AlertTriangle} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Panel title="معدل استهلاك السولار لكل أتوبيس (لتر/١٠٠ كم)" className="xl:col-span-2">
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fuelChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.42 0.045 258 / 40%)" />
                <XAxis dataKey="bus" stroke="#c9d1e0" fontSize={12} />
                <YAxis stroke="#c9d1e0" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.79 0.135 88 / 8%)" }} />
                <Bar dataKey="لتر/100كم" fill="var(--color-chart-1)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="مركز التنبيهات">
          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-bold text-primary">
                    {a.type === "صيانة" ? <Wrench className="h-4 w-4" /> : <FileWarning className="h-4 w-4" />}
                    {a.type}
                  </span>
                  <StatusPill label={a.level} tone={a.level === "عاجل" ? "bad" : "warn"} />
                </div>
                <p className="mt-2 text-sm text-foreground">{a.text}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="المصروفات مقابل الإيرادات الشهرية">
          <div className="h-80" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyFinance}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.42 0.045 258 / 40%)" />
                <XAxis dataKey="month" stroke="#c9d1e0" fontSize={12} />
                <YAxis stroke="#c9d1e0" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontFamily: "Cairo, sans-serif", color: "#fff" }} />
                <Line type="monotone" dataKey="الإيرادات" stroke="var(--color-chart-1)" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="المصروفات" stroke="var(--color-chart-4)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
