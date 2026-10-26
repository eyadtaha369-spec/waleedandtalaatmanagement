import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, Panel } from "@/components/ui-kit";
import { currency } from "@/lib/fleet-data";
import { closeFinancialMonth, fetchMonthClosings, nextMonthPrefix, unlockFinancialMonth, type MonthClosing } from "@/lib/queries";
import { useMyRole } from "@/lib/permissions";

const prevMonth = () => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1, 1);
  return d.toISOString().slice(0, 7);
};

/** «إغلاق الشهر المالي 🔒» — يرحّل أرصدة الخزينة كأرصدة افتتاحية ويحفظ لقطة الإغلاق. */
export function MonthClosePanel({ onClosed }: { onClosed?: () => void }) {
  const [closings, setClosings] = useState<MonthClosing[]>([]);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(prevMonth());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MonthClosing | null>(null);
  const isAdmin = useMyRole() === "admin";
  const [note, setNote] = useState("");
  const [working, setWorking] = useState("");

  const unlock = async (m: string) => {
    setWorking(m);
    setNote("");
    try {
      await unlockFinancialMonth(m);
      await load();
      onClosed?.();
      setNote(`شهر ${m} مفتوح الآن للتعديل. بعد التصحيح أعد قفله بزرار «إعادة القفل».`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "تعذر فتح الشهر");
    } finally {
      setWorking("");
    }
  };
  const relock = async (m: string) => {
    setWorking(m);
    setNote("");
    try {
      await closeFinancialMonth(m, "");
      await load();
      onClosed?.();
      setNote(`تم إعادة قفل شهر ${m} بلقطة جديدة.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "تعذر إعادة القفل");
    } finally {
      setWorking("");
    }
  };

  const load = () => fetchMonthClosings().then(setClosings).catch(() => setClosings([]));
  useEffect(() => {
    load();
  }, []);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const c = await closeFinancialMonth(month, "");
      setResult(c);
      await load();
      onClosed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إغلاق الشهر");
    } finally {
      setBusy(false);
    }
  };
  const show = result;

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
        <span>
          {closings[0] ? `آخر شهر مغلق: ${closings[0].month}` : "لم يُغلق أي شهر مالي بعد."} — الإغلاق يقفل حركات الشهر ويرحّل أرصدة الخزينة كأرصدة افتتاحية للشهر التالي.
        </span>
        <Button className="bg-primary text-primary-foreground" onClick={() => { setResult(null); setError(""); setOpen(true); }}>
          <Lock className="ml-2 h-4 w-4" /> إغلاق الشهر المالي 🔒
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إغلاق الشهر المالي</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              يُحسب صافي الخزينة والعهدة وأرصدة الشركات والمرتبات، وتُرحَّل أرصدة الخزينة كرصيد افتتاحي بتاريخ أول {show ? nextMonthPrefix(show.month) : nextMonthPrefix(month)}.
            </DialogDescription>
          </DialogHeader>
          {!show ? (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الشهر المراد إغلاقه</Label>
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border-border bg-input/60" />
              </div>
              {closings.some((c) => c.month === month && c.locked) && <p className="text-sm text-warning">هذا الشهر مغلق بالفعل.</p>}
              {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <div className="grid gap-3 text-sm">
              <p className="rounded-lg border border-success/40 bg-success/10 p-2 text-success">تم إغلاق شهر {show.month} وترحيل الأرصدة.</p>
              <Summary c={show} />
            </div>
          )}
          <DialogFooter>
            {!show && <Button className="bg-primary text-primary-foreground" onClick={run} disabled={busy || !month}>{busy ? "جارِ الإغلاق..." : "تأكيد الإغلاق والترحيل"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {closings.some((c) => !c.locked) && (
        <p className="no-print mb-4 rounded-xl border-2 border-orange-500 bg-orange-500/10 p-3 text-sm font-bold text-orange-500">
          🔓 تنبيه: الشهر {closings.filter((c) => !c.locked).map((c) => c.month).join("، ")} مفتوح للتعديل الإداري — أعد قفله بعد تصحيح الأخطاء.
        </p>
      )}
      {closings.length > 0 && (
        <Panel title="سجل الإغلاق المالي" className="no-print mb-4">
          {note && <p className="mb-2 rounded-lg border border-primary/40 bg-primary/10 p-2 text-sm">{note}</p>}
          <DataTable head={["الشهر", "الحالة", "صافي الخزينة", "رصيد العهدة", "مستحقات الشركات", "صافي المرتبات", "تاريخ الإغلاق", ""]}>
            {closings.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-bold">{c.month}</td>
                <td className="px-4 py-3">{c.locked ? <span className="font-bold text-success">🔒 مقفول</span> : <span className="font-bold text-warning">🔓 مفتوح للتعديل</span>}</td>
                <td className="px-4 py-3">{currency(c.snapshot.treasuryTotal)}</td>
                <td className="px-4 py-3">{currency(c.snapshot.custodyClosing)}</td>
                <td className="px-4 py-3">{currency(c.snapshot.clientsTotal)}</td>
                <td className="px-4 py-3">{currency(c.snapshot.payrollNet)}</td>
                <td className="px-4 py-3 text-xs">{c.closedAt.slice(0, 10)}{c.closedBy ? ` — ${c.closedBy}` : ""}</td>
                <td className="px-4 py-3">
                  {c.locked ? (
                    isAdmin && <Button size="sm" variant="outline" className="border-warning/60 text-warning" disabled={working === c.month} onClick={() => unlock(c.month)}>فتح الشهر للتعديل (إداري) 🔓</Button>
                  ) : (
                    <Button size="sm" className="bg-primary text-primary-foreground" disabled={working === c.month} onClick={() => relock(c.month)}>إعادة القفل 🔒</Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      )}
    </>
  );
}

function Summary({ c }: { c: MonthClosing }) {
  const s = c.snapshot;
  const rows: [string, number][] = [
    ["صافي أرصدة الخزينة", s.treasuryTotal],
    ["رصيد عهدة الخزينة", s.custodyClosing],
    ["مستحقات الشركات المرحّلة", s.clientsTotal],
    ["صافي المرتبات", s.payrollNet],
  ];
  return (
    <div className="grid gap-2">
      {rows.map(([l, v]) => (
        <div key={l} className="flex justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2"><span className="text-muted-foreground">{l}</span><b>{currency(v)}</b></div>
      ))}
      {s.treasury.length > 0 && (
        <div className="rounded-lg border border-border p-2">
          <p className="mb-1 text-xs text-muted-foreground">الأرصدة الافتتاحية المرحّلة للخزينة</p>
          {s.treasury.map((t) => <div key={t.account} className="flex justify-between text-xs"><span>{t.account}</span><b>{currency(t.closing)}</b></div>)}
        </div>
      )}
    </div>
  );
}
