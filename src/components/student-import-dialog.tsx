import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dbErrorMessage, fetchStudentImportContext, importStudents } from "@/lib/queries";
import { IMPORT_FIELD_LABEL, mapColumns, parseStudentRows, reviewStudents, summarizeImport, type ImportField, type ReviewedStudent } from "@/lib/student-import";
import { currency } from "@/lib/fleet-data";

const BADGE = {
  valid: { label: "جاهز للاستيراد", cls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-500" },
  duplicate: { label: "مسجل مسبقًا", cls: "border-amber-500/40 bg-amber-500/15 text-amber-500" },
  superseded: { label: "مكرر — استُبدل بأحدث", cls: "border-amber-500/40 bg-amber-500/15 text-amber-500" },
  refund: { label: "استرداد — مستبعد", cls: "border-destructive/40 bg-destructive/15 text-destructive" },
  invalid: { label: "بيانات ناقصة", cls: "border-destructive/40 bg-destructive/15 text-destructive" },
} as const;

export function StudentImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [rows, setRows] = useState<ReviewedStudent[]>([]);
  const [mapped, setMapped] = useState<ImportField[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setMapped([]);
    setFileName("");
    setError("");
    setResult("");
    setProgress([0, 0]);
  };

  const readFile = useCallback(async (file: File) => {
    reset();
    setFileName(file.name);
    setBusy(true);
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("صيغة الملف غير مدعومة — استخدم .xlsx أو .xls أو .csv");
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
      if (!sheet) throw new Error("الملف لا يحتوي على أي ورقة بيانات");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      if (raw.length === 0) throw new Error("الملف فارغ");
      const map = mapColumns(Object.keys(raw[0] ?? {}));
      if (!map.name) throw new Error("لم أجد عمود «اسم الطالب» في الملف — راجع عناوين الأعمدة");
      const parsed = parseStudentRows(raw, map);
      const ctx = await fetchStudentImportContext();
      setMapped((Object.keys(map) as ImportField[]).filter((k) => map[k]?.length));
      setRows(reviewStudents(parsed, ctx.students, ctx.routes));
    } catch (e) {
      setError(dbErrorMessage(e, "تعذرت قراءة الملف"));
    } finally {
      setBusy(false);
    }
  }, []);

  const valid = rows.filter((r) => r.status === "valid");
  const sum = summarizeImport(rows);
  const nf = (n: number) => n.toLocaleString("en-US");
  const dup = rows.filter((r) => r.status === "duplicate" || r.status === "superseded").length;
  const refunds = rows.filter((r) => r.status === "refund").length;
  const invalid = rows.filter((r) => r.status === "invalid").length;
  const newRoutes = [...new Set(valid.filter((r) => r.newRoute).map((r) => r.routeName))];

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await importStudents(rows, (d, t) => setProgress([d, t]));
      setResult(`تم حفظ ${res.students} طالب${res.routesCreated ? `، وإنشاء ${res.routesCreated} خط جديد` : ""}${res.payments ? `، وتسجيل ${res.payments} دفعة` : ""}.`);
      setRows([]);
      onDone();
    } catch (e) {
      setError(dbErrorMessage(e, "تعذر حفظ الطلاب"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="glass max-h-[90vh] max-w-5xl overflow-y-auto text-foreground" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-primary">استيراد ملف إكسيل للطلاب</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            ارفع شيت الحجز (.xlsx / .xls / .csv) وسيتم مطابقة الأعمدة تلقائيًا، ثم راجع الصفوف قبل الحفظ.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void readFile(f); }}
          onClick={() => input.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${drag ? "border-primary bg-primary/10" : "border-border bg-secondary/20"}`}
        >
          <Upload className="h-7 w-7 text-primary" />
          <p className="text-sm font-bold">{fileName || "اسحب الملف هنا أو اضغط للاختيار"}</p>
          <p className="text-xs text-muted-foreground">xlsx • xls • csv</p>
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
        </div>

        {busy && progress[1] === 0 && <p className="text-sm text-muted-foreground">جاري المعالجة…</p>}
        {busy && progress[1] > 0 && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${(progress[0] / progress[1]) * 100}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">جاري الحفظ… {progress[0]} من {progress[1]} طالب</p>
          </div>
        )}
        {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        {result && <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-sm font-bold text-emerald-500">{result}</p>}

        {rows.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              الأعمدة المطابقة: {mapped.map((m) => IMPORT_FIELD_LABEL[m]).join(" • ")}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { label: "عدد الطلاب المعتمدين", value: nf(sum.approved), tone: "text-primary" },
                { label: "إجمالي المحصل (EGP)", value: nf(sum.collected), tone: "text-emerald-500" },
                { label: "إجمالي المتبقي / الأقساط (EGP)", value: nf(sum.remaining), tone: "text-amber-500" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-primary/30 bg-secondary/40 p-3">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className={`mt-1 text-2xl font-extrabold ${c.tone}`}>{c.value}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-amber-500">مكرر / مسجل (سيتم تخطيه): {dup}</span>
              {refunds > 0 && <span className="rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1 text-destructive">حالات استرداد مستبعدة: {refunds}</span>}
              {invalid > 0 && <span className="rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1 text-destructive">ناقص: {invalid}</span>}
              {newRoutes.length > 0 && <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-primary">خطوط جديدة ستُنشأ: {newRoutes.join("، ")}</span>}
            </div>
            <div className="max-h-[40vh] overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground">
                  <tr>{["#", "الطالب", "هاتف الطالب", "هاتف ولي الأمر", "الخط", "نقطة الركوب", "نوع الاشتراك", "المستحق", "المدفوع", "المتبقي", "الحالة"].map((h) => <th key={h} className="px-3 py-2 text-right font-bold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNum} className={`border-t border-border/60 ${r.status === "valid" ? "" : "opacity-70"}`}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.rowNum}</td>
                      <td className="px-3 py-2 font-bold">{r.name || "—"}</td>
                      <td className="px-3 py-2">{r.studentPhone || "—"}</td>
                      <td className="px-3 py-2">{r.parentPhone || "—"}</td>
                      <td className="px-3 py-2">{r.routeName || "—"}{r.newRoute && <span className="mr-1 text-[10px] text-primary">(جديد)</span>}</td>
                      <td className="px-3 py-2">{r.pickupPoint || "—"}</td>
                      <td className="px-3 py-2">{r.subscriptionType || "—"}</td>
                      <td className="px-3 py-2">{r.target ? currency(r.target) : "—"}</td>
                      <td className="px-3 py-2">{r.amountPaid ? currency(r.amountPaid) : "—"}</td>
                      <td className="px-3 py-2 text-amber-500">{r.remaining ? currency(r.remaining) : "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold ${BADGE[r.status].cls}`}>{BADGE[r.status].label}</span>
                        {r.reason && <div className="text-[10px] text-muted-foreground">{r.reason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="border-border" disabled={busy} onClick={() => { onOpenChange(false); reset(); }}>إغلاق</Button>
          <Button className="bg-primary text-primary-foreground" disabled={busy || valid.length === 0} onClick={confirm}>
            <FileSpreadsheet className="ml-2 h-4 w-4" /> تأكيد وحفظ {valid.length} طالب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
