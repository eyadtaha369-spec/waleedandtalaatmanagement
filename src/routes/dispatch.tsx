import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { currency } from "@/lib/fleet-data";
import { fetchBuses, fetchDrivers, fetchClients } from "@/lib/queries";
import {
  fetchDailyOperations,
  addDailyOperation,
  updateDailyOperation,
  deleteDailyOperation,
  type DailyOperation,
} from "@/lib/queries";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [{ title: "الحركة والورديات اليومية | وليد وطلعت" }],
  }),
  component: DispatchPage,
});

const emptyForm = {
  id: "",
  date: new Date().toISOString().slice(0, 10),
  busCode: "",
  driverName: "",
  gasCost: "",
  gasLiters: "",
  odometerReading: "",
  client1Name: "",
  route1: "",
  fare1: "",
  client2Name: "",
  route2: "",
  fare2: "",
  notes: "",
};

function DispatchPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [ops, setOps] = useState<DailyOperation[]>([]);
  const [busCodes, setBusCodes] = useState<string[]>([]);
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [clientNames, setClientNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showShift2, setShowShift2] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DailyOperation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, buses, drivers, clients] = await Promise.all([
        fetchDailyOperations(month),
        fetchBuses(),
        fetchDrivers(),
        fetchClients(),
      ]);
      setOps(o);
      setBusCodes(buses.map((b) => b.code));
      setDriverNames(drivers.map((d) => d.name));
      setClientNames(clients.map((c) => c.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const openAdd = () => {
    setForm(emptyForm);
    setShowShift2(false);
    setAdding(true);
  };

  const openEdit = (o: DailyOperation) => {
    setForm({
      id: o.id,
      date: o.date,
      busCode: o.bus === "—" ? "" : o.bus,
      driverName: o.driver === "—" ? "" : o.driver,
      gasCost: String(o.gasCost),
      gasLiters: String(o.gasLiters),
      odometerReading: String(o.odometerReading),
      client1Name: o.client1 === "—" ? "" : o.client1,
      route1: o.route1,
      fare1: String(o.fare1),
      client2Name: o.client2 === "—" ? "" : o.client2,
      route2: o.route2,
      fare2: String(o.fare2),
      notes: o.notes,
    });
    setShowShift2(!!o.route2 || o.fare2 > 0 || (o.client2 !== "—" && o.client2 !== ""));
    setAdding(true);
  };

  const submit = async () => {
    if (!form.busCode.trim() || !form.driverName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        busCode: form.busCode,
        driverName: form.driverName,
        gasCost: Number(form.gasCost) || 0,
        gasLiters: Number(form.gasLiters) || 0,
        odometerReading: Number(form.odometerReading) || 0,
        client1Name: form.client1Name,
        route1: form.route1,
        fare1: Number(form.fare1) || 0,
        client2Name: showShift2 ? form.client2Name : "",
        route2: showShift2 ? form.route2 : "",
        fare2: showShift2 ? Number(form.fare2) || 0 : 0,
        notes: form.notes,
      };
      if (form.id) await updateDailyOperation(form.id, payload);
      else await addDailyOperation(payload);
      await loadAll();
      setForm(emptyForm);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الحركة اليومية");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDailyOperation(deleteTarget.id);
      await loadAll();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف الحركة");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = ops.filter(
    (o) => (o.bus + o.driver + o.client1 + o.client2).includes(query) || query === "",
  );

  return (
    <AppShell>
      <PageHeader title="الحركة والورديات اليومية" subtitle="تسجيل تشغيل الأتوبيسات اليومي: الوقود والورديات لكل شركة" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Panel title="سجل الحركة اليومية">
        <Toolbar
          query={query}
          onQuery={setQuery}
          placeholder="ابحث بالأتوبيس، السائق، أو الشركة..."
          onExport={() => exportToExcel("الحركة اليومية", filtered as unknown as Record<string, string | number>[])}
          extra={
            <>
              <Input value={month} onChange={(e) => setMonth(e.target.value)} type="month" className="h-9 w-40 border-border bg-input/60" />
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAdd}>
                <Plus className="ml-2 h-4 w-4" /> تسجيل حركة
              </Button>
            </>
          }
        />
        <DataTable head={["التاريخ", "الأتوبيس", "السائق", "الوقود", "الشركة 1 / الخط", "قيمة 1", "الشركة 2 / الخط", "قيمة 2", "الإجراءات"]}>
          {loading ? (
            <tr>
              <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">لا توجد حركات مسجلة لهذا الشهر بعد.</td>
            </tr>
          ) : (
            filtered.map((o) => (
              <tr key={o.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">{o.date}</td>
                <td className="px-4 py-3 font-bold text-primary">{o.bus}</td>
                <td className="px-4 py-3">{o.driver}</td>
                <td className="px-4 py-3 text-warning">{currency(o.gasCost)}</td>
                <td className="px-4 py-3 text-xs">{o.client1 !== "—" ? `${o.client1} / ${o.route1 || "—"}` : "—"}</td>
                <td className="px-4 py-3 text-success">{currency(o.fare1)}</td>
                <td className="px-4 py-3 text-xs">{o.client2 !== "—" ? `${o.client2} / ${o.route2 || "—"}` : "—"}</td>
                <td className="px-4 py-3 text-success">{o.fare2 > 0 ? currency(o.fare2) : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(o)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(o)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Panel>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass max-h-[85vh] overflow-y-auto text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{form.id ? "تعديل حركة يومية" : "تسجيل حركة يومية جديدة"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">بيانات الوقود والوردية (أو الورديتين) لهذا الأتوبيس اليوم</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">التاريخ</Label>
                <Input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} type="date" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الأتوبيس</Label>
                <Select value={form.busCode} onValueChange={(v) => setForm({ ...form, busCode: v })}>
                  <SelectTrigger className="border-border bg-input/60">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    {busCodes.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">السائق</Label>
                <Select value={form.driverName} onValueChange={(v) => setForm({ ...form, driverName: v })}>
                  <SelectTrigger className="border-border bg-input/60">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    {driverNames.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/20 p-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تكلفة الوقود</Label>
                <Input value={form.gasCost} onChange={(e) => setForm({ ...form, gasCost: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">كمية الوقود (لتر)</Label>
                <Input value={form.gasLiters} onChange={(e) => setForm({ ...form, gasLiters: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">قراءة العداد</Label>
                <Input value={form.odometerReading} onChange={(e) => setForm({ ...form, odometerReading: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="mb-2 text-xs font-bold text-primary">الوردية 1</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">الشركة</Label>
                  <Select value={form.client1Name} onValueChange={(v) => setForm({ ...form, client1Name: v })}>
                    <SelectTrigger className="border-border bg-input/60">
                      <SelectValue placeholder="اختر" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientNames.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">الخط</Label>
                  <Input value={form.route1} onChange={(e) => setForm({ ...form, route1: e.target.value })} className="border-border bg-input/60" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">القيمة</Label>
                  <Input value={form.fare1} onChange={(e) => setForm({ ...form, fare1: e.target.value })} type="number" className="border-border bg-input/60" />
                </div>
              </div>
            </div>

            {!showShift2 ? (
              <button
                type="button"
                className="text-right text-xs text-primary hover:underline"
                onClick={() => setShowShift2(true)}
              >
                + إضافة وردية ثانية (اختياري)
              </button>
            ) : (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-primary">الوردية 2</p>
                  <button type="button" className="text-xs text-destructive hover:underline" onClick={() => setShowShift2(false)}>
                    إزالة
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">الشركة</Label>
                    <Select value={form.client2Name} onValueChange={(v) => setForm({ ...form, client2Name: v })}>
                      <SelectTrigger className="border-border bg-input/60">
                        <SelectValue placeholder="اختر" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientNames.map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">الخط</Label>
                    <Input value={form.route2} onChange={(e) => setForm({ ...form, route2: e.target.value })} className="border-border bg-input/60" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">القيمة</Label>
                    <Input value={form.fare2} onChange={(e) => setForm({ ...form, fare2: e.target.value })} type="number" className="border-border bg-input/60" />
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>
              {saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ الحركة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف حركة {deleteTarget?.bus} بتاريخ {deleteTarget?.date} نهائيًا. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "جارِ الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
