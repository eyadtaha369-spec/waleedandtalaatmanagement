import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bus as BusIcon, Fuel, Gauge, Printer, Receipt, Route as RouteIcon, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DateRangeFilter } from "@/components/date-range-filter";
import { DataTable, PageHeader, Panel, StatCard, StatusPill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currency, type Bus } from "@/lib/fleet-data";
import {
  FUEL_BASIS_LABEL,
  computeBusProfile,
  fetchBusProfile,
  fetchBuses,
  periodLabel,
  rangeForPreset,
  updateBusFuelTarget,
  type BusProfileData,
  type DateRange,
  type FuelBasis,
} from "@/lib/queries";

export const Route = createFileRoute("/fleet-performance")({
  head: () => ({ meta: [{ title: "ملف وكفاءة الأسطول | وليد وطلعت" }] }),
  component: FleetPerformancePage,
});

const num = (n: number, d = 1) => (Number.isFinite(n) ? n.toLocaleString("ar-EG", { maximumFractionDigits: d }) : "—");
const msg = (e: unknown, fb: string) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? fb);
const statusTone = (s: string) => (s === "تعمل" ? "good" : s === "بالورشة" ? "warn" : "bad") as "good" | "warn" | "bad";

function FleetPerformancePage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(rangeForPreset("current"));
  const [data, setData] = useState<BusProfileData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [basis, setBasis] = useState<FuelBasis>("shift");
  const [saving, setSaving] = useState(false);

  const loadBuses = async () => {
    try {
      setBuses(await fetchBuses());
    } catch (e) {
      setError(msg(e, "تعذر تحميل الأسطول"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadBuses();
  }, []);

  const bus = buses.find((b) => b.id === selectedId) ?? null;

  useEffect(() => {
    if (!bus) return;
    setTargetInput(bus.fuelTarget != null ? String(bus.fuelTarget) : "");
    setBasis(bus.fuelBasis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, buses]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDataLoading(true);
    fetchBusProfile(selectedId, range)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(msg(e, "تعذر تحميل بيانات العربية")))
      .finally(() => !cancelled && setDataLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedId, range]);

  const target = targetInput.trim() === "" ? null : Number(targetInput) || null;
  const profile = useMemo(() => (data ? computeBusProfile(data, target, basis) : null), [data, target, basis]);

  const saveTarget = async () => {
    if (!bus) return;
    setSaving(true);
    try {
      await updateBusFuelTarget(bus.id, target, basis);
      await loadBuses();
    } catch (e) {
      setError(msg(e, "تعذر حفظ المعيار"));
    } finally {
      setSaving(false);
    }
  };

  const printReport = () => {
    document.body.classList.add("print-statement");
    const cleanup = () => {
      document.body.classList.remove("print-statement");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 150);
  };

  const unit = basis === "km100" ? "لتر/100كم" : "لتر/وردية";
  const fuel = profile?.fuel;
  const border = { border: "1px solid #000", padding: 6 } as const;

  return (
    <AppShell>
      <PageHeader title="ملف وكفاءة الأسطول" subtitle="الملف الكامل لكل عربية: التشغيل والصيانة والسولار مع كشف الهدر" />
      {error && <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {!bus ? (
        loading ? (
          <p className="py-10 text-center text-muted-foreground">جارِ التحميل...</p>
        ) : buses.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">لا توجد عربيات مسجلة بعد.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {buses.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className="panel group relative overflow-hidden p-5 text-right transition-all hover:-translate-y-1 hover:border-primary/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-extrabold text-primary">{b.code}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{b.plate}</p>
                  </div>
                  <BusIcon className="h-8 w-8 text-primary/70 transition-transform group-hover:scale-110" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <StatusPill label={b.status} tone={statusTone(b.status)} />
                  <span className="rounded-full border border-border px-2 py-0.5">{b.busType}</span>
                  <span className="rounded-full border border-border px-2 py-0.5">{b.model}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border bg-secondary/20 p-2">
                    <dt className="text-muted-foreground">عداد الكيلومترات</dt>
                    <dd className="font-bold">{num(b.odometer, 0)} كم</dd>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-2">
                    <dt className="text-muted-foreground">معيار السولار</dt>
                    <dd className="font-bold">{b.fuelTarget != null ? `${num(b.fuelTarget, 2)} ${b.fuelBasis === "km100" ? "ل/100كم" : "ل/وردية"}` : "غير محدد"}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-primary">اضغط لفتح ملف العربية ←</p>
              </button>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" className="border-border" onClick={() => { setSelectedId(null); setData(null); }}>
              <ArrowRight className="ml-2 h-4 w-4" /> كل العربيات
            </Button>
            <Button className="bg-primary text-primary-foreground" disabled={!profile} onClick={printReport}>
              <Printer className="ml-2 h-4 w-4" /> طباعة التقرير الشهري الشامل للعربية 🖨️
            </Button>
          </div>

          <Panel title={`${bus.code} — ${bus.plate} (${bus.busType} / ${bus.model})`} className="mb-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <DateRangeFilter value={range} onChange={setRange} />
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">معيار الاستهلاك المستهدف</Label>
                  <Input type="number" min="0" step="any" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} className="border-border bg-input/60" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">وحدة المعيار</Label>
                  <Select value={basis} onValueChange={(v) => setBasis(v as FuelBasis)}>
                    <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shift">{FUEL_BASIS_LABEL.shift}</SelectItem>
                      <SelectItem value="km100">{FUEL_BASIS_LABEL.km100}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="bg-primary text-primary-foreground" onClick={saveTarget} disabled={saving}>{saving ? "..." : "حفظ المعيار"}</Button>
              </div>
            </div>
          </Panel>

          {dataLoading || !profile || !fuel || !data ? (
            <p className="py-10 text-center text-muted-foreground">جارِ التحميل...</p>
          ) : (
            <>
              {fuel.status === "waste" && (
                <div className="mb-4 rounded-xl border border-red-500/60 bg-red-500/10 p-4">
                  <p className="text-lg font-extrabold text-red-600">⚠️ يوجد هدر في السولار بنسبة {num(fuel.wastePct)}%</p>
                  <p className="mt-1 text-sm">
                    الاستهلاك الفعلي {num(fuel.actual ?? 0, 2)} مقابل المعيار {num(fuel.target ?? 0, 2)} ({unit}) — لترات مهدرة: <b>{num(fuel.wastedLiters)} لتر</b> — تكلفة زائدة: <b>{currency(fuel.excessCost)}</b>
                  </p>
                </div>
              )}
              {fuel.status === "ok" && (
                <div className="mb-4 rounded-xl border border-success/50 bg-success/10 p-4">
                  <p className="text-lg font-extrabold text-success">✅ استهلاك منتظم ضمن المعيار</p>
                  <p className="mt-1 text-sm">الفعلي {num(fuel.actual ?? 0, 2)} مقابل المعيار {num(fuel.target ?? 0, 2)} ({unit})</p>
                </div>
              )}
              {fuel.status === "no-target" && <p className="mb-4 rounded-xl border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">حدّد «معيار الاستهلاك المستهدف» لهذه العربية لتفعيل كشف الهدر.</p>}
              {fuel.status === "no-data" && <p className="mb-4 rounded-xl border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">لا توجد بيانات سولار أو {basis === "km100" ? "مسافة (عداد)" : "ورديات"} كافية في هذه الفترة لحساب الاستهلاك.</p>}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="الورديات والمشاوير" value={String(profile.shifts)} icon={RouteIcon} />
                <StatCard label="إيرادات الفترة" value={currency(profile.revenue)} icon={Receipt} />
                <StatCard label="مصروفات الصيانة" value={currency(profile.maintenanceTotal)} icon={Wrench} />
                <StatCard label="السولار" value={`${num(profile.liters)} لتر`} hint={currency(profile.fuelCost)} icon={Fuel} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <StatCard label={`الاستهلاك الفعلي (${unit})`} value={fuel.actual != null ? num(fuel.actual, 2) : "—"} {...(fuel.target != null ? { hint: `المعيار ${num(fuel.target, 2)}` } : {})} icon={Gauge} />
                <StatCard label="المسافة المسجلة بالسولار" value={`${num(profile.km, 0)} كم`} icon={BusIcon} />
              </div>

              <Tabs defaultValue="ops" className="mt-4">
                <TabsList className="no-print mb-4 flex-wrap border border-border bg-secondary/50">
                  <TabsTrigger value="ops">الورديات والمشاوير ({data.activities.length})</TabsTrigger>
                  <TabsTrigger value="maint">الصيانة ({data.maintenance.length})</TabsTrigger>
                  <TabsTrigger value="fuel">سجل السولار ({data.fuel.length})</TabsTrigger>
                  <TabsTrigger value="drivers">السائقون ({profile.drivers.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="ops">
                  <DataTable head={["التاريخ", "النوع", "الخط / الوجهة", "الشركة", "السائق", "الإيراد"]}>
                    {data.activities.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">لا توجد حركات في هذه الفترة.</td></tr>
                    ) : (
                      data.activities.map((a) => (
                        <tr key={a.key} className="hover:bg-secondary/30">
                          <td className="px-4 py-3">{a.date}</td>
                          <td className="px-4 py-3">{a.kind}</td>
                          <td className="px-4 py-3">{a.route || "—"}</td>
                          <td className="px-4 py-3">{a.client}</td>
                          <td className="px-4 py-3">{a.driver}</td>
                          <td className="px-4 py-3 font-bold">{currency(a.revenue)}</td>
                        </tr>
                      ))
                    )}
                  </DataTable>
                </TabsContent>
                <TabsContent value="maint">
                  <DataTable head={["التاريخ", "رقم الأمر", "العطل", "الحالة", "قطع الغيار المستخدمة", "التكلفة"]}>
                    {data.maintenance.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">لا توجد أوامر صيانة في هذه الفترة.</td></tr>
                    ) : (
                      data.maintenance.map((m) => (
                        <tr key={m.id} className="hover:bg-secondary/30">
                          <td className="px-4 py-3">{m.date}</td>
                          <td className="px-4 py-3">{m.code}</td>
                          <td className="px-4 py-3">{m.issue}</td>
                          <td className="px-4 py-3">{m.status}</td>
                          <td className="px-4 py-3 text-xs">{m.parts.length ? m.parts.map((p) => `${p.name} ×${p.quantity}`).join("، ") : "—"}</td>
                          <td className="px-4 py-3 font-bold">{currency(m.total)}</td>
                        </tr>
                      ))
                    )}
                  </DataTable>
                </TabsContent>
                <TabsContent value="fuel">
                  <DataTable head={["التاريخ", "السائق", "اللترات", "التكلفة", "المسافة (كم)"]}>
                    {data.fuel.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">لا توجد تعبئات في هذه الفترة.</td></tr>
                    ) : (
                      data.fuel.map((f) => (
                        <tr key={f.id} className="hover:bg-secondary/30">
                          <td className="px-4 py-3">{f.date}</td>
                          <td className="px-4 py-3">{f.driver}</td>
                          <td className="px-4 py-3">{num(f.liters)}</td>
                          <td className="px-4 py-3">{currency(f.cost)}</td>
                          <td className="px-4 py-3">{f.km ? num(f.km, 0) : "—"}</td>
                        </tr>
                      ))
                    )}
                  </DataTable>
                </TabsContent>
                <TabsContent value="drivers">
                  <DataTable head={["السائق", "عدد الورديات والمشاوير"]}>
                    {profile.drivers.length === 0 ? (
                      <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">لا يوجد سائقون مسجلون في هذه الفترة.</td></tr>
                    ) : (
                      profile.drivers.map((d) => (
                        <tr key={d.name} className="hover:bg-secondary/30">
                          <td className="px-4 py-3 font-bold">{d.name}</td>
                          <td className="px-4 py-3">{d.count}</td>
                        </tr>
                      ))
                    )}
                  </DataTable>
                </TabsContent>
              </Tabs>

              <div className="print-only" dir="rtl">
                <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 800 }}>وليد وطلعت لخدمات النقل والرحلات</h1>
                <h2 style={{ textAlign: "center", fontSize: 18, margin: "8px 0 16px" }}>التقرير الشهري الشامل للعربية</h2>
                <p style={{ marginBottom: 6 }}>
                  <b>العربية:</b> {bus.code} &nbsp;&nbsp; <b>اللوحة:</b> {bus.plate} &nbsp;&nbsp; <b>النوع:</b> {bus.busType} &nbsp;&nbsp; <b>الموديل:</b> {bus.model}
                </p>
                <p style={{ marginBottom: 12 }}>
                  <b>الفترة:</b> {periodLabel(range)} &nbsp;&nbsp; <b>تاريخ الطباعة:</b> {new Date().toISOString().slice(0, 10)}
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
                  <tbody>
                    {[
                      ["إجمالي الورديات والمشاوير", String(profile.shifts)],
                      ["إجمالي الإيرادات", currency(profile.revenue)],
                      ["إجمالي مصروفات الصيانة", currency(profile.maintenanceTotal)],
                      ["إجمالي السولار", `${num(profile.liters)} لتر — ${currency(profile.fuelCost)}`],
                    ].map(([k, v]) => (
                      <tr key={k}><td style={{ ...border, background: "#eee", width: "40%" }}>{k}</td><td style={border}>{v}</td></tr>
                    ))}
                  </tbody>
                </table>
                <h3 style={{ fontWeight: 800, margin: "8px 0" }}>تحليل هدر السولار</h3>
                <p style={{ marginBottom: 12 }}>
                  {fuel.status === "waste" && `⚠️ يوجد هدر في السولار بنسبة ${num(fuel.wastePct)}% — الفعلي ${num(fuel.actual ?? 0, 2)} مقابل المعيار ${num(fuel.target ?? 0, 2)} (${unit}) — لترات مهدرة ${num(fuel.wastedLiters)} لتر — تكلفة زائدة ${currency(fuel.excessCost)}`}
                  {fuel.status === "ok" && `✅ استهلاك منتظم ضمن المعيار — الفعلي ${num(fuel.actual ?? 0, 2)} مقابل المعيار ${num(fuel.target ?? 0, 2)} (${unit})`}
                  {fuel.status === "no-target" && "لم يُحدَّد معيار استهلاك لهذه العربية."}
                  {fuel.status === "no-data" && "لا توجد بيانات كافية لحساب الاستهلاك في هذه الفترة."}
                </p>
                <h3 style={{ fontWeight: 800, margin: "8px 0" }}>سجل السائقين</h3>
                <p style={{ marginBottom: 12 }}>{profile.drivers.length ? profile.drivers.map((d) => `${d.name} (${d.count})`).join("، ") : "—"}</p>
                <h3 style={{ fontWeight: 800, margin: "8px 0" }}>الورديات والمشاوير</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
                  <thead><tr>{["التاريخ", "النوع", "الخط / الوجهة", "الشركة", "السائق", "الإيراد"].map((h) => <th key={h} style={{ ...border, background: "#eee" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.activities.map((a) => (
                      <tr key={a.key}><td style={border}>{a.date}</td><td style={border}>{a.kind}</td><td style={border}>{a.route || "—"}</td><td style={border}>{a.client}</td><td style={border}>{a.driver}</td><td style={border}>{currency(a.revenue)}</td></tr>
                    ))}
                  </tbody>
                </table>
                {data.maintenance.length > 0 && (
                  <>
                    <h3 style={{ fontWeight: 800, margin: "8px 0" }}>الصيانة</h3>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr>{["التاريخ", "العطل", "القطع", "التكلفة"].map((h) => <th key={h} style={{ ...border, background: "#eee" }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {data.maintenance.map((m) => (
                          <tr key={m.id}><td style={border}>{m.date}</td><td style={border}>{m.issue}</td><td style={border}>{m.parts.map((p) => `${p.name} ×${p.quantity}`).join("، ") || "—"}</td><td style={border}>{currency(m.total)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
