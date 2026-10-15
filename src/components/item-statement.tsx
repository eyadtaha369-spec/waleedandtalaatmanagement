import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/date-range-filter";
import { computeItemLedger, dbErrorMessage, fetchItemMovements, type DateRange, type ItemMovement } from "@/lib/queries";
import { currency, type InventoryItem } from "@/lib/fleet-data";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
};
const KIND_LABEL = { IN: "إضافة / توريد من مورد", OUT: "سحب / صرف لصيانة سيارة" } as const;
const HEAD = ["التاريخ والوقت", "نوع الحركة", "الجهة / البيان", "الكمية الواردة (+)", "الكمية المنصرفة (−)", "سعر الوحدة", "إجمالي القيمة", "الرصيد التراكمي"];

export function ItemStatementSheet({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [moves, setMoves] = useState<ItemMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return;
    let live = true;
    setLoading(true);
    setError("");
    setRange({ from: "", to: "" });
    fetchItemMovements(item.id)
      .then((m) => live && setMoves(m))
      .catch((e) => live && setError(dbErrorMessage(e, "تعذر تحميل حركة الصنف")))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [item]);

  const ledger = useMemo(() => (item ? computeItemLedger(moves, range, item.stock, item.unitPrice) : null), [moves, range, item]);

  const print = () => {
    document.body.classList.add("print-statement");
    const cleanup = () => {
      document.body.classList.remove("print-statement");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 150);
  };

  const cards = ledger
    ? [
        { label: "إجمالي الوارد", value: fmt(ledger.totalIn), tone: "text-emerald-500" },
        { label: "إجمالي المنصرف", value: fmt(ledger.totalOut), tone: "text-destructive" },
        { label: "الرصيد الحالي بالمخزن", value: fmt(ledger.currentStock), tone: "text-primary" },
        { label: "إجمالي قيمة المخزون الحالي", value: currency(ledger.stockValue), tone: "text-primary" },
      ]
    : [];
  const rangeText = `${range.from || "البداية"} إلى ${range.to || "اليوم"}`;

  return (
    <>
      <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="left" dir="rtl" className="glass w-full overflow-y-auto text-foreground sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle className="text-primary">كشف حركة الصنف: {item?.name}</SheetTitle>
            <SheetDescription className="text-muted-foreground">كود {item?.code || "—"} • حركة الوارد والمنصرف بالتاريخ والرصيد التراكمي</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <DateRangeFilter value={range} onChange={setRange} />
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {cards.map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className={`mt-1 text-lg font-extrabold ${c.tone}`}>{c.value}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs text-muted-foreground">
                  <tr>{HEAD.map((h) => <th key={h} className="px-3 py-2 text-right font-bold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">جاري التحميل…</td></tr>
                  ) : !ledger || ledger.rows.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">لا توجد حركات في هذه الفترة.</td></tr>
                  ) : (
                    ledger.rows.map((r) => (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="px-3 py-2 whitespace-nowrap">{r.date} <span className="text-xs text-muted-foreground">{timeOf(r.at)}</span></td>
                        <td className={`px-3 py-2 text-xs font-bold ${r.kind === "IN" ? "text-emerald-500" : "text-destructive"}`}>{KIND_LABEL[r.kind]}</td>
                        <td className="px-3 py-2">{r.party}</td>
                        <td className="px-3 py-2 font-bold text-emerald-500">{r.qtyIn ? `+${fmt(r.qtyIn)}` : "—"}</td>
                        <td className="px-3 py-2 font-bold text-destructive">{r.qtyOut ? `−${fmt(r.qtyOut)}` : "—"}</td>
                        <td className="px-3 py-2">{currency(r.unitPrice)}</td>
                        <td className="px-3 py-2">{currency(r.value)}</td>
                        <td className="px-3 py-2 font-extrabold">{fmt(r.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Button className="bg-primary text-primary-foreground" onClick={print} disabled={!ledger || ledger.rows.length === 0}>
              <Printer className="ml-2 h-4 w-4" /> طباعة كشف حركة الصنف 🖨️
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {item && ledger && ledger.rows.length > 0 && (
        <div className="print-only" dir="rtl">
          <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 800 }}>وليد وطلعت لخدمات النقل والرحلات</h1>
          <h2 style={{ textAlign: "center", fontSize: 18, margin: "8px 0 16px" }}>كشف حساب حركة صنف</h2>
          <p style={{ marginBottom: 6 }}>
            <b>الصنف:</b> {item.name} ({item.code || "—"}) &nbsp;&nbsp; <b>الفترة:</b> {rangeText} &nbsp;&nbsp; <b>تاريخ الطباعة:</b> {new Date().toISOString().slice(0, 10)}
          </p>
          <p style={{ marginBottom: 12 }}>
            <b>رصيد أول الفترة:</b> {fmt(ledger.openingBalance)} &nbsp;|&nbsp; <b>إجمالي الوارد:</b> {fmt(ledger.totalIn)} &nbsp;|&nbsp; <b>إجمالي المنصرف:</b> {fmt(ledger.totalOut)} &nbsp;|&nbsp; <b>الرصيد الحالي:</b> {fmt(ledger.currentStock)} &nbsp;|&nbsp; <b>قيمة المخزون الحالي:</b> {currency(ledger.stockValue)}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>{HEAD.map((h) => <th key={h} style={{ border: "1px solid #000", padding: 5, background: "#eee" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {ledger.rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ border: "1px solid #000", padding: 5 }}>{r.date} {timeOf(r.at)}</td>
                  <td style={{ border: "1px solid #000", padding: 5 }}>{KIND_LABEL[r.kind]}</td>
                  <td style={{ border: "1px solid #000", padding: 5 }}>{r.party}</td>
                  <td style={{ border: "1px solid #000", padding: 5 }}>{r.qtyIn ? `+${fmt(r.qtyIn)}` : "—"}</td>
                  <td style={{ border: "1px solid #000", padding: 5 }}>{r.qtyOut ? `−${fmt(r.qtyOut)}` : "—"}</td>
                  <td style={{ border: "1px solid #000", padding: 5 }}>{currency(r.unitPrice)}</td>
                  <td style={{ border: "1px solid #000", padding: 5 }}>{currency(r.value)}</td>
                  <td style={{ border: "1px solid #000", padding: 5, fontWeight: 700 }}>{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 800 }}>
                <td colSpan={3} style={{ border: "1px solid #000", padding: 5 }}>الإجمالي</td>
                <td style={{ border: "1px solid #000", padding: 5 }}>{fmt(ledger.totalIn)}</td>
                <td style={{ border: "1px solid #000", padding: 5 }}>{fmt(ledger.totalOut)}</td>
                <td style={{ border: "1px solid #000", padding: 5 }}>—</td>
                <td style={{ border: "1px solid #000", padding: 5 }}>{currency(ledger.totalInValue - ledger.totalOutValue)}</td>
                <td style={{ border: "1px solid #000", padding: 5 }}>{fmt(ledger.currentStock)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
