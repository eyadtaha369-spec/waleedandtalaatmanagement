import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { fetchBuses, fetchDrivers } from "@/lib/queries";
import { fetchTrips, addTrip, updateTrip, deleteTrip, type Trip } from "@/lib/queries";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [{ title: "إدارة الرحلات والتنبيهات | وليد وطلعت" }],
  }),
  component: TripsPage,
});

const emptyForm = {
  id: "",
  clientName: "",
  clientPhone: "",
  busCode: "",
  driverName: "",
  tripDate: new Date().toISOString().slice(0, 16),
  destination: "",
  totalPrice: "",
  amountPaid: "",
  driverFee: "",
  status: "مجدولة",
};

const statusTone = (s: Trip["status"]) =>
  (s === "مكتملة" ? "good" : s === "جاري التنفيذ" ? "info" : s === "ملغاة" ? "bad" : "warn") as const;

function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [busCodes, setBusCodes] = useState<string[]>([]);
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [printTrip, setPrintTrip] = useState<Trip | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, buses, drivers] = await Promise.all([fetchTrips(), fetchBuses(), fetchDrivers()]);
      setTrips(t);
      setBusCodes(buses.map((b) => b.code));
      setDriverNames(drivers.map((d) => d.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل بيانات الرحلات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setAdding(true);
  };

  const openEdit = (t: Trip) => {
    setForm({
      id: t.id,
      clientName: t.clientName,
      clientPhone: t.clientPhone,
      busCode: t.bus === "—" ? "" : t.bus,
      driverName: t.driver === "—" ? "" : t.driver,
      tripDate: t.tripDate.slice(0, 16),
      destination: t.destination,
      totalPrice: String(t.totalPrice),
      amountPaid: String(t.amountPaid),
      driverFee: String(t.driverFee),
      status: t.status,
    });
    setAdding(true);
  };

  const submit = async () => {
    if (!form.clientName.trim() || !form.tripDate.trim()) return;
    setSaving(true);
    try {
      const payload = {
        clientName: form.clientName,
        clientPhone: form.clientPhone,
        busCode: form.busCode,
        driverName: form.driverName,
        tripDate: form.tripDate,
        destination: form.destination,
        totalPrice: Number(form.totalPrice) || 0,
        amountPaid: Number(form.amountPaid) || 0,
        driverFee: Number(form.driverFee) || 0,
        status: form.status,
      };
      if (form.id) await updateTrip(form.id, payload);
      else await addTrip(payload);
      await loadAll();
      setForm(emptyForm);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الرحلة");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTrip(deleteTarget.id);
      await loadAll();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف الرحلة");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(
    () => trips.filter((t) => (t.clientName + t.destination + t.bus + t.driver).includes(query) || query === ""),
    [trips, query],
  );
  const upcoming = filtered.filter((t) => t.status === "مجدولة" || t.status === "جاري التنفيذ");
  const finished = filtered.filter((t) => t.status === "مكتملة" || t.status === "ملغاة");
  const withBalance = filtered.filter((t) => t.balanceDue > 0);

  const renderTable = (rows: Trip[]) => (
    <DataTable head={["العميل", "الهاتف", "التاريخ والوقت", "الجهة", "الأتوبيس", "السائق", "الإجمالي", "المحصل", "المتبقي", "أجر السائق", "الحالة", "الإجراءات"]}>
      {loading ? (
        <tr>
          <td colSpan={12} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
        </tr>
      ) : rows.length === 0 ? (
        <tr>
          <td colSpan={12} className="px-4 py-6 text-center text-muted-foreground">لا توجد رحلات في هذا القسم.</td>
        </tr>
      ) : (
        rows.map((t) => (
          <tr key={t.id} className="transition-colors hover:bg-secondary/30">
            <td className="px-4 py-3 font-bold">{t.clientName}</td>
            <td className="px-4 py-3">{t.clientPhone || "—"}</td>
            <td className="px-4 py-3 text-xs">{new Date(t.tripDate).toLocaleString("ar-EG")}</td>
            <td className="px-4 py-3">{t.destination || "—"}</td>
            <td className="px-4 py-3 text-primary">{t.bus}</td>
            <td className="px-4 py-3">{t.driver}</td>
            <td className="px-4 py-3">{currency(t.totalPrice)}</td>
            <td className="px-4 py-3 text-success">{currency(t.amountPaid)}</td>
            <td className={t.balanceDue > 0 ? "px-4 py-3 font-bold text-destructive" : "px-4 py-3 text-success"}>{currency(t.balanceDue)}</td>
            <td className="px-4 py-3 text-warning">{currency(t.driverFee)}</td>
            <td className="px-4 py-3">
              <StatusPill label={t.status} tone={statusTone(t.status)} />
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => setPrintTrip(t)}>
                  <Printer className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(t)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </td>
          </tr>
        ))
      )}
    </DataTable>
  );

  return (
    <AppShell>
      <PageHeader title="إدارة الرحلات والتنبيهات" subtitle="حجز الرحلات الخاصة والخارجيات، ومتابعة المستحقات المالية" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Panel title="سجل الرحلات">
        <Toolbar
          query={query}
          onQuery={setQuery}
          placeholder="ابحث باسم العميل، الجهة، الأتوبيس، أو السائق..."
          onExport={() => exportToExcel("الرحلات", filtered as unknown as Record<string, string | number>[])}
          extra={
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAdd}>
              <Plus className="ml-2 h-4 w-4" /> حجز / تسجيل رحلة جديدة
            </Button>
          }
        />
        <Tabs defaultValue="upcoming">
          <TabsList className="no-print mb-4 flex-wrap border border-border bg-secondary/50">
            <TabsTrigger value="upcoming">الرحلات القادمة ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="finished">الرحلات المنتهية ({finished.length})</TabsTrigger>
            <TabsTrigger value="balance">المتبقيات المالية ({withBalance.length})</TabsTrigger>
            <TabsTrigger value="all">الكل ({filtered.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming">{renderTable(upcoming)}</TabsContent>
          <TabsContent value="finished">{renderTable(finished)}</TabsContent>
          <TabsContent value="balance">{renderTable(withBalance)}</TabsContent>
          <TabsContent value="all">{renderTable(filtered)}</TabsContent>
        </Tabs>
      </Panel>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass max-h-[85vh] overflow-y-auto text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{form.id ? "تعديل رحلة" : "حجز / تسجيل رحلة جديدة"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">بيانات العميل والرحلة والتكلفة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">اسم العميل</Label>
                <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">هاتف العميل</Label>
                <Input value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} type="tel" className="border-border bg-input/60" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تاريخ ووقت الرحلة</Label>
                <Input value={form.tripDate} onChange={(e) => setForm({ ...form, tripDate: e.target.value })} type="datetime-local" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">جهة الرحلة</Label>
                <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">إجمالي سعر الرحلة</Label>
                <Input value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">المبلغ المحصل</Label>
                <Input value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">أجر السائق</Label>
                <Input value={form.driverFee} onChange={(e) => setForm({ ...form, driverFee: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="مجدولة">مجدولة</SelectItem>
                  <SelectItem value="جاري التنفيذ">جاري التنفيذ</SelectItem>
                  <SelectItem value="مكتملة">مكتملة</SelectItem>
                  <SelectItem value="ملغاة">ملغاة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>
              {saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ الرحلة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!printTrip} onOpenChange={(o) => !o && setPrintTrip(null)}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إيصال حجز رحلة</DialogTitle>
          </DialogHeader>
          {printTrip && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-4 text-sm">
              <p className="text-center text-lg font-extrabold text-gold-gradient">وليد وطلعت لخدمات النقل والرحلات</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <p><b>العميل:</b> {printTrip.clientName}</p>
                <p><b>الهاتف:</b> {printTrip.clientPhone || "—"}</p>
                <p><b>الجهة:</b> {printTrip.destination || "—"}</p>
                <p><b>التاريخ:</b> {new Date(printTrip.tripDate).toLocaleString("ar-EG")}</p>
                <p><b>الأتوبيس:</b> {printTrip.bus}</p>
                <p><b>السائق:</b> {printTrip.driver}</p>
                <p><b>الإجمالي:</b> {currency(printTrip.totalPrice)}</p>
                <p><b>المحصل:</b> {currency(printTrip.amountPaid)}</p>
                <p><b>المتبقي:</b> {currency(printTrip.balanceDue)}</p>
                <p><b>الحالة:</b> {printTrip.status}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={() => window.print()}>
              <Printer className="ml-2 h-4 w-4" /> طباعة الإيصال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف رحلة {deleteTarget?.clientName} نهائيًا.
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
