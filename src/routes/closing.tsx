import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel } from "@/components/ui-kit";
import { PersonPicker } from "@/components/person-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currency } from "@/lib/fleet-data";
import { useMyRole } from "@/lib/permissions";
import { CLOSING_MODULES, closeModuleMonth, closeSupplierMonth, fetchClients, fetchSuppliers, fetchSupplierClosings, unlockSupplierMonth, type Supplier, type SupplierClosing, fetchModuleClosings, unlockModuleMonth, type ClosingModule, type Client, type ModuleClosing } from "@/lib/queries";

export const Route = createFileRoute("/closing")({
  head: () => ({ meta: [{ title: "الإغلاق المالي الشهري | وليد وطلعت" }] }),
  component: ClosingPage,
});

const prevMonth = () => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1, 1);
  return d.toISOString().slice(0, 7);
};
const money = (v: unknown) => currency(Number(v ?? 0));

function summaryLines(m: ClosingModule, s: Record<string, any>): [string, string][] {
  switch (m) {
    case "treasury":
      return [["صافي أرصدة الخزينة (مرحَّلة كافتتاحي)", money(s["treasuryTotal"])], ["رصيد العهدة", money(s["custodyClosing"])], ...((s["treasury"] ?? []) as { account: string; closing: number }[]).map((t): [string, string] => [`↳ ${t.account}`, money(t.closing)])];
    case "clients":
      return [["إجمالي المتبقي على الشركات", money(s["total"])], ...((s["receivable"] ?? []) as { client: string; closing: number }[]).slice(0, 8).map((c): [string, string] => [`↳ ${c.client}`, money(c.closing)])];
    case "payroll":
      return [["صافي المرتبات", money(s["payrollNet"])], ["عدد السائقين / الموظفين", `${s["drivers"] ?? 0} / ${s["employees"] ?? 0}`]];
    case "suppliers":
      return [["مستحق الموردين", money(s["suppliersPayable"])], ["مستحق مُلّاك المستأجرة (غير مسدد)", money(s["rentedOwnersUnpaid"])]];
    case "workshop":
      return [["عدد الأوامر", String(s["orders"] ?? 0)], ["إجمالي التكلفة", money(s["totalCost"])], ["المصنعية", money(s["labor"])], ["قطع مسحوبة من المخزن", money(s["partsFromStock"])]];
    default:
      return [["عدد مرات التزود", String(s["fills"] ?? 0)], ["اللترات", String(Math.round(Number(s["liters"] ?? 0)))], ["التكلفة", money(s["cost"])]];
  }
}

function ClosingPage() {
  const isAdmin = useMyRole() === "admin";
  const [month, setMonth] = useState(prevMonth());
  const [rows, setRows] = useState<ModuleClosing[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supClosings, setSupClosings] = useState<SupplierClosing[]>([]);
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    try {
      const [r, sc, sup] = await Promise.all([fetchModuleClosings(month), fetchSupplierClosings(month), fetchSuppliers()]);
      setRows(r);
      setSupClosings(sc);
      setSuppliers(sup);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "تعذر التحميل" });
    }
  };
  useEffect(() => {
    load();
  }, [month]);
  useEffect(() => {
    fetchClients().then(setClients).catch(() => setClients([]));
  }, []);

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    if (!isAdmin) {
      setMsg({ ok: false, text: "عذراً، الإغلاق المالي وفتح الشهر متاحان لمسؤول النظام (المدير) فقط" });
      return;
    }
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      await load();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر التنفيذ" });
    } finally {
      setBusy("");
    }
  };

  return (
    <AppShell>
      <PageHeader title="الإغلاق المالي الشهري" subtitle="إغلاق مستقل لكل قسم: يقفل حركات الشهر ويحفظ لقطة بأرصدته، ويمكن فتح أي قسم للتصحيح دون التأثير على باقي الأقسام" />
      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">الشهر</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48 border-border bg-input/60" />
        </div>
      </div>
      {!isAdmin && <p className="mb-4 rounded-lg border border-[#EF4444]/50 bg-[#EF4444]/10 p-3 text-sm font-bold text-[#EF4444]">🔒 الإغلاق المالي وفتح الشهر متاحان لمسؤول النظام (المدير) فقط — الصفحة للعرض.</p>}
      {msg && <p className={`mb-4 rounded-lg border p-3 text-sm ${msg.ok ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>{msg.text}</p>}

      <div className="grid gap-4">
        {CLOSING_MODULES.map((m) => {
          const mine = rows.filter((r) => r.module === m.key);
          const all = mine.find((r) => !r.clientId);
          const perClient = mine.filter((r) => r.clientId);
          const lockedAll = !!all?.locked;
          const reopened = all && !all.locked;
          const scopeRow = m.key === "clients" ? (scope ? perClient.find((r) => r.clientId === scope) : all) : all;
          const scopeLocked = !!scopeRow?.locked;
          return (
            <Panel key={m.key} title={m.title}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[16rem] flex-1">
                  <p className="text-sm text-muted-foreground">{m.desc}</p>
                  <p className="mt-2">
                    {lockedAll ? (
                      <span className="rounded-full border border-success/50 bg-success/10 px-3 py-1 text-sm font-bold text-success">مغلق ومؤرشف 🔒</span>
                    ) : (
                      <span className="rounded-full border border-warning/50 bg-warning/10 px-3 py-1 text-sm font-bold text-warning">
                        {reopened ? "مفتوح للتعديل (أُعيد فتحه) 🔓" : "مفتوح للشهر الحالي 🟢"}
                      </span>
                    )}
                    {m.key === "suppliers" && supClosings.some((r) => r.locked) && <span className="mr-2 text-xs text-muted-foreground">+ {supClosings.filter((r) => r.locked).length} مورد مغلق منفردًا</span>}
                    {m.key === "clients" && perClient.some((r) => r.locked) && <span className="mr-2 text-xs text-muted-foreground">+ {perClient.filter((r) => r.locked).length} شركة مغلقة منفردة</span>}
                  </p>
                </div>
                <div className="no-print flex flex-wrap items-end gap-2">
                  {m.key === "clients" && (
                    <div className="grid w-56 gap-1.5">
                      <Label className="text-xs text-muted-foreground">النطاق</Label>
                      <PersonPicker value={scope} options={[{ value: "", label: "إجمالي الشركات", group: "الكل" }, ...clients.map((c) => ({ value: c.id, label: c.name, group: "شركة" }))]} onChange={setScope} placeholder="إجمالي الشركات" />
                    </div>
                  )}
                  <Button className="bg-primary text-primary-foreground" disabled={!isAdmin || busy === m.key || scopeLocked} onClick={() => run(m.key, () => closeModuleMonth(month, m.key, m.key === "clients" ? scope : ""), `تم ${scopeRow ? "إعادة قفل" : "إغلاق"} ${m.title.replace("إغلاق ", "")} لشهر ${month}`)}>
                    {scopeRow && !scopeRow.locked ? "إعادة القفل 🔒" : "إغلاق الشهر 🔒"}
                  </Button>
                  {isAdmin && scopeRow?.locked && (
                    <Button variant="outline" className="border-warning/60 text-warning" disabled={busy === scopeRow.id} onClick={() => run(scopeRow.id, () => unlockModuleMonth(scopeRow.id), "تم فتح التعديل لهذا القسم فقط")}>
                      إلغاء الإغلاق / فتح التعديل 🔓
                    </Button>
                  )}
                </div>
              </div>
              {(scopeRow || all) && (
                <div className="mt-3 grid gap-1 rounded-lg border border-border bg-secondary/20 p-3 text-sm sm:grid-cols-2">
                  {summaryLines(m.key, (scopeRow ?? all)!.snapshot).map(([l, v]) => (
                    <div key={l} className="flex justify-between gap-2"><span className="text-muted-foreground">{l}</span><b>{v}</b></div>
                  ))}
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    {(scopeRow ?? all)!.locked ? "أُغلق" : "أُغلق سابقًا"} بتاريخ {(scopeRow ?? all)!.closedAt.slice(0, 10)}{(scopeRow ?? all)!.closedBy ? ` — ${(scopeRow ?? all)!.closedBy}` : ""}
                  </p>
                </div>
              )}
              {m.key === "suppliers" && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 text-xs text-muted-foreground">
                      <tr>
                        {["المورد", "الرصيد المستحق", "الحالة", "إجراءات"].map((h) => <th key={h} className="px-3 py-2 text-right font-medium">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">لا يوجد موردون مسجلون.</td></tr>}
                      {suppliers.map((s) => {
                        const c = supClosings.find((x) => x.supplierId === s.id);
                        const locked = !!c?.locked;
                        return (
                          <tr key={s.id} className="border-t border-border">
                            <td className="px-3 py-2 font-bold">{s.name}</td>
                            <td className="px-3 py-2 text-warning">
                              {money(s.balanceDue)}
                              {c && <span className="mr-2 block text-xs text-muted-foreground">ختامي الشهر عند الإغلاق: {money(c.snapshot.closing)}</span>}
                            </td>
                            <td className="px-3 py-2">
                              {locked ? (
                                <span className="rounded-full border border-success/50 bg-success/10 px-2 py-1 text-xs font-bold text-success">مغلق 🔒</span>
                              ) : (
                                <span className="rounded-full border border-warning/50 bg-warning/10 px-2 py-1 text-xs font-bold text-warning">{c ? "أُعيد فتحه 🔓" : "مفتوح 🟢"}</span>
                              )}
                            </td>
                            <td className="no-print px-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" className="bg-primary text-primary-foreground" disabled={!isAdmin || locked || busy === `s${s.id}`} onClick={() => run(`s${s.id}`, () => closeSupplierMonth(month, s.id), `تم ${c ? "إعادة قفل" : "إغلاق"} حساب ${s.name} لشهر ${month}`)}>
                                  {c && !c.locked ? "إعادة القفل 🔒" : "إغلاق الشهر 🔒"}
                                </Button>
                                {isAdmin && locked && c && (
                                  <Button size="sm" variant="outline" className="border-warning/60 text-warning" disabled={busy === c.id} onClick={() => run(c.id, () => unlockSupplierMonth(c.id), `تم فتح التعديل لحساب ${s.name} فقط`)}>
                                    فتح التعديل 🔓
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {m.key === "clients" && perClient.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {perClient.map((r) => (
                    <span key={r.id} className={`rounded-full border px-2 py-1 ${r.locked ? "border-success/50 text-success" : "border-warning/50 text-warning"}`}>{r.clientName || "شركة"} {r.locked ? "🔒" : "🔓"}</span>
                  ))}
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </AppShell>
  );
}
