import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { AlertTriangle, Bus, Coins, TrendingDown, TrendingUp, Users, Wallet, Wrench, FileWarning } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatCard, StatusPill } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { currency, type Bus as BusType, type Student } from "@/lib/fleet-data";
import {
  fetchBuses,
  fetchStudents,
  fetchAlerts,
  fetchFuelChart,
  fetchMonthlyFinance,
  fetchTreasury,
  fetchDailyOperations,
  fetchExpenses,
  fetchDriverPayroll,
  computeMonthlyPL,
  type AlertRow,
} from "@/lib/queries";

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
  const [buses, setBuses] = useState<BusType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [fuelChart, setFuelChart] = useState<{ bus: string; "لتر/100كم": number }[]>([]);
  const [monthlyFinance, setMonthlyFinance] = useState<{ month: string; الإيرادات: number; المصروفات: number }[]>([]);
  const [todayReceipts, setTodayReceipts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [plMonth, setPlMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pl, setPl] = useState({ totalRevenue: 0, totalExpenses: 0, netProfit: 0 });
  const [expenseBreakdown, setExpenseBreakdown] = useState<{ category: string; المبلغ: number }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [b, s, a, fc, mf, treasury] = await Promise.all([
          fetchBuses(),
          fetchStudents(),
          fetchAlerts(),
          fetchFuelChart(),
          fetchMonthlyFinance(),
          fetchTreasury(),
        ]);
        setBuses(b);
        setStudents(s);
        setAlerts(a);
        setFuelChart(fc);
        setMonthlyFinance(mf);
        const today = new Date().toISOString().slice(0, 10);
        setTodayReceipts(treasury.filter((t) => t.date === today).reduce((sum, t) => sum + t.deposits, 0));
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر تحميل بيانات لوحة التحكم");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [ops, allExpenses, payroll] = await Promise.all([
          fetchDailyOperations(plMonth),
          fetchExpenses(),
          fetchDriverPayroll(plMonth),
        ]);
        const monthExpenses = allExpenses.filter((e) => e.date.startsWith(plMonth));
        const generalExpenseTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const netPayrollTotal = payroll.reduce((sum, p) => sum + p.netSalary, 0);
        setPl(computeMonthlyPL(ops, generalExpenseTotal, netPayrollTotal));

        const byCategory = new Map<string, number>();
        for (const e of monthExpenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
        const gasTotal = ops.reduce((sum, o) => sum + o.gasCost, 0);
        if (gasTotal > 0) byCategory.set("غاز (الحركة اليومية)", (byCategory.get("غاز (الحركة اليومية)") ?? 0) + gasTotal);
        setExpenseBreakdown(Array.from(byCategory.entries()).map(([category, المبلغ]) => ({ category, المبلغ })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر تحميل بيانات الأرباح والخسائر");
      }
    })();
  }, [plMonth]);

  const working = buses.filter((b) => b.status === "تعمل").length;
  const inShop = buses.filter((b) => b.status === "بالورشة").length;
  const stopped = buses.filter((b) => b.status === "متوقفة").length;
  const late = students.filter((s) => s.status === "متأخر").length;

  return (
    <AppShell>
      <PageHeader
        title="لوحة التحكّم التنفيذية"
        subtitle="نظرة شاملة على أداء الأسطول والتشغيل والمالية"
      />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Panel title="لوحة الأرباح والخسائر التنفيذية">
        <div className="mb-4 flex justify-end">
          <Input value={plMonth} onChange={(e) => setPlMonth(e.target.value)} type="month" className="h-9 w-40 border-border bg-input/60" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="إجمالي إيرادات الشركات (دائن)" value={currency(pl.totalRevenue)} icon={TrendingUp} />
          <StatCard label="إجمالي المصروفات التشغيلية (مدين)" value={currency(pl.totalExpenses)} icon={TrendingDown} />
          <div className="panel relative overflow-hidden p-5">
            <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">صافي الربح الشهري</p>
                <p className="mt-2 text-2xl font-extrabold text-gold-gradient">{currency(pl.netProfit)}</p>
                <p className="mt-2 text-xs text-muted-foreground">إيرادات الشركات - (الوقود + المصروفات العامة + صافي المرتبات)</p>
              </div>
              <span className="rounded-xl border border-primary/40 bg-primary/10 p-2.5">
                <Wallet className="h-5 w-5 text-primary" />
              </span>
            </div>
          </div>
        </div>

        {expenseBreakdown.length > 0 && (
          <div className="mt-5 h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.42 0.045 258 / 40%)" />
                <XAxis type="number" stroke="#c9d1e0" fontSize={12} />
                <YAxis type="category" dataKey="category" stroke="#c9d1e0" fontSize={12} width={140} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.79 0.135 88 / 8%)" }} />
                <Bar dataKey="المبلغ" fill="var(--color-chart-4)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إجمالي الأتوبيسات"
          value={`${buses.length} أتوبيس`}
          hint={`${working} تعمل • ${inShop} بالورشة • ${stopped} معطلة`}
          icon={Bus}
        />
        <StatCard label="الإيرادات والمقبوضات اليومية" value={currency(todayReceipts)} hint="مقبوضات نقدية وتحويلات اليوم" icon={Coins} />
        <StatCard label="إجمالي الطلاب والمشتركين" value={`${students.length} مشترك`} hint={`${late} حالات سداد متأخرة`} icon={Users} />
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
            {alerts.length === 0 && <li className="text-sm text-muted-foreground">لا توجد تنبيهات حالياً.</li>}
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
