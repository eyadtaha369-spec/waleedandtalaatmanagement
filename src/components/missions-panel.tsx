import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { BusPicker } from "@/components/bus-picker";
import { AccountPicker } from "@/components/account-picker";
import { DateRangeFilter } from "@/components/date-range-filter";
import { DataTable, Panel, StatusPill, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { currency, type Bus, type Driver } from "@/lib/fleet-data";
import {
  MISSION_SOURCE_LABEL,
  RENTED_VEHICLE_TYPES,
  addMission,
  deleteMission,
  fetchBuses,
  fetchClients,
  fetchDrivers,
  fetchMissions,
  inDateRange,
  missionNet,
  rangeForPreset,
  updateMission,
  type Client,
  type DateRange,
  type Mission,
  type MissionSource,
} from "@/lib/queries";

const todayStr = () => new Date().toISOString().slice(0, 10);
const NONE = "__none";

const emptyForm = () => ({
  id: "", date: todayStr(), clientId: "", clientName: "", vehicleType: "", source: "internal" as MissionSource, route: "",
  waitingHours: "", clientPrice: "", vehicleCost: "", driverFee: "", busId: "", driverId: "", owner: "", busLabel: "", externalDriver: "", notes: "",
});

const msg = (e: unknown, fb: string) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? fb);

export function MissionsPanel() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [range, setRange] = useState<DateRange>(rangeForPreset("current"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Mission | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [m, c, b, d] = await Promise.all([fetchMissions(), fetchClients(), fetchBuses(), fetchDrivers()]);
      setMissions(m);
      setClients(c);
      setBuses(b);
      setDrivers(d);
    } catch (e) {
      setError(msg(e, "تعذر تحميل المأموريات"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => missions.filter((m) => inDateRange(m.date, range)), [missions, range]);
  const totals = useMemo(
    () => ({ price: rows.reduce((s, m) => s + m.clientPrice, 0), cost: rows.reduce((s, m) => s + m.vehicleCost, 0), fee: rows.reduce((s, m) => s + m.driverFee, 0), net: rows.reduce((s, m) => s + missionNet(m), 0) }),
    [rows],
  );

  const formNet = missionNet({ clientPrice: Number(form.clientPrice) || 0, vehicleCost: form.source === "rented" ? Number(form.vehicleCost) || 0 : 0, driverFee: Number(form.driverFee) || 0 });

  const openAdd = () => {
    setForm(emptyForm());
    setError(null);
    setAdding(true);
  };
  const openEdit = (m: Mission) => {
    setForm({ id: m.id, date: m.date, clientId: m.clientId, clientName: m.clientName, vehicleType: m.vehicleType, source: m.source, route: m.route, waitingHours: String(m.waitingHours), clientPrice: String(m.clientPrice), vehicleCost: String(m.vehicleCost), driverFee: String(m.driverFee), busId: m.busId, driverId: m.driverId, owner: m.owner, busLabel: m.busLabel, externalDriver: m.externalDriver, notes: m.notes });
    setError(null);
    setAdding(true);
  };

  const submit = async () => {
    if (!form.clientId) return setError("اختر الشركة من القائمة");
    if (!form.vehicleType) return setError("اختر نوع السيارة");
    if (!form.route.trim()) return setError("أدخل بيانات المشوار (من وإلى)");
    if (form.source === "rented" && (!form.owner.trim() || !form.busLabel.trim())) return setError("أدخل صاحب السيارة ورقم / اسم السيارة المستأجرة");
    setSaving(true);
    setError(null);
    try {
      const payload = {
        date: form.date, clientId: form.clientId, vehicleType: form.vehicleType, source: form.source, route: form.route,
        waitingHours: Number(form.waitingHours) || 0, clientPrice: Number(form.clientPrice) || 0, vehicleCost: Number(form.vehicleCost) || 0, driverFee: Number(form.driverFee) || 0,
        busId: form.busId, driverId: form.driverId, owner: form.owner, busLabel: form.busLabel, externalDriver: form.externalDriver, notes: form.notes,
      };
      if (form.id) await updateMission(form.id, payload);
      else await addMission(payload);
      await load();
      setAdding(false);
    } catch (e) {
      setError(msg(e, "تعذر حفظ المأمورية"));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMission(deleteTarget.id);
      await load();
      setDeleteTarget(null);
    } catch (e) {
      setError(msg(e, "تعذر الحذف"));
      setDeleteTarget(null);
    }
  };

  const driverName = (m: Mission) => drivers.find((d) => d.id === m.driverId)?.name ?? (m.externalDriver || "—");
  const vehicleLabel = (m: Mission) => (m.source === "rented" ? `${m.busLabel} (${m.owner})` : buses.find((b) => b.id === m.busId)?.plate ?? "—");

  return (
    <>
      {error && !adding && <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Panel title="فترة العرض" className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </Panel>
      <Panel title="المأموريات">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            عند الحفظ تُرحَّل المأمورية تلقائيًا: مطالبة على كشف حساب الشركة، ومستحق على صاحب السيارة المستأجرة، وأجر السائق في المرتبات.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border" onClick={() => exportToExcel("المأموريات", rows.map((m) => ({ التاريخ: m.date, الشركة: m.clientName, "نوع السيارة": m.vehicleType, المصدر: MISSION_SOURCE_LABEL[m.source], المشوار: m.route, "ساعات الانتظار": m.waitingHours, "سعر الشركة": m.clientPrice, "تكلفة السيارة": m.vehicleCost, "أجر السائق": m.driverFee, الصافي: missionNet(m) })))}>
              تصدير Excel
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAdd}>
              <Plus className="ml-2 h-4 w-4" /> تسجيل مأمورية جديدة
            </Button>
          </div>
        </div>
        <DataTable head={["التاريخ", "الشركة", "نوع السيارة", "المصدر", "السيارة", "السائق", "المشوار", "انتظار (س)", "سعر الشركة", "تكلفة السيارة", "أجر السائق", "الصافي", "الإجراءات"]}>
          {loading ? (
            <tr><td colSpan={13} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={13} className="px-4 py-6 text-center text-muted-foreground">لا توجد مأموريات في هذه الفترة.</td></tr>
          ) : (
            rows.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">{m.date}</td>
                <td className="px-4 py-3 font-bold">{m.clientName}</td>
                <td className="px-4 py-3">{m.vehicleType}</td>
                <td className="px-4 py-3"><StatusPill label={m.source === "rented" ? "مستأجرة" : "أسطول داخلي"} tone={m.source === "rented" ? "warn" : "info"} /></td>
                <td className="px-4 py-3">{vehicleLabel(m)}</td>
                <td className="px-4 py-3">{driverName(m)}</td>
                <td className="px-4 py-3">{m.route}</td>
                <td className="px-4 py-3">{m.waitingHours || "—"}</td>
                <td className="px-4 py-3 font-bold">{currency(m.clientPrice)}</td>
                <td className="px-4 py-3">{currency(m.vehicleCost)}</td>
                <td className="px-4 py-3">{currency(m.driverFee)}</td>
                <td className={`px-4 py-3 font-bold ${missionNet(m) < 0 ? "text-destructive" : "text-success"}`}>{currency(missionNet(m))}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(m)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </DataTable>
        {rows.length > 0 && (
          <p className="mt-3 text-sm font-bold">
            الإجمالي: سعر الشركات {currency(totals.price)} | تكلفة السيارات {currency(totals.cost)} | أجور السائقين {currency(totals.fee)} | الصافي {currency(totals.net)}
          </p>
        )}
      </Panel>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{form.id ? "تعديل المأمورية" : "تسجيل مأمورية جديدة"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">يُرحَّل الحساب تلقائيًا عند الحفظ، وأي تعديل لاحق يُحدِّث الحسابات المرتبطة.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">التاريخ</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الشركة *</Label>
                <AccountPicker strict value={form.clientName} clients={clients} placeholder="ابحث عن شركة..." onPick={(name, id) => setForm({ ...form, clientName: name, clientId: id })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">نوع السيارة *</Label>
                <Select value={form.vehicleType} onValueChange={(v) => setForm({ ...form, vehicleType: v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                  <SelectContent>{RENTED_VEHICLE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">مصدر السيارة</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as MissionSource })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">{MISSION_SOURCE_LABEL.internal}</SelectItem>
                    <SelectItem value="rented">{MISSION_SOURCE_LABEL.rented}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.source === "internal" ? (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الأتوبيس / السيارة من الأسطول</Label>
                <BusPicker by="id" value={form.busId} buses={buses} allowNone placeholder="بدون تحديد" onChange={(v) => setForm({ ...form, busId: v })} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">صاحب السيارة / مكتب التأجير *</Label>
                  <Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="border-border bg-input/60" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">رقم / اسم السيارة المستأجرة *</Label>
                  <Input value={form.busLabel} onChange={(e) => setForm({ ...form, busLabel: e.target.value })} className="border-border bg-input/60" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">السائق (يُرحَّل أجره للمرتبات)</Label>
                <Select value={form.driverId || NONE} onValueChange={(v) => setForm({ ...form, driverId: v === NONE ? "" : v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>سائق خارجي / بدون تحديد</SelectItem>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.source === "rented" && !form.driverId && (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">اسم السائق الخارجي</Label>
                  <Input value={form.externalDriver} onChange={(e) => setForm({ ...form, externalDriver: e.target.value })} className="border-border bg-input/60" />
                </div>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">بيانات المشوار (من وإلى) *</Label>
              <Input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="مثال: الإسكندرية ← القاهرة" className="border-border bg-input/60" />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">ساعات الانتظار</Label>
                <Input type="number" min="0" step="any" value={form.waitingHours} onChange={(e) => setForm({ ...form, waitingHours: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">سعر المأمورية للشركة</Label>
                <Input type="number" min="0" step="any" value={form.clientPrice} onChange={(e) => setForm({ ...form, clientPrice: e.target.value })} className="border-border bg-input/60" />
              </div>
              {form.source === "rented" && (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">تكلفة السيارة / صاحب السيارة</Label>
                  <Input type="number" min="0" step="any" value={form.vehicleCost} onChange={(e) => setForm({ ...form, vehicleCost: e.target.value })} className="border-border bg-input/60" />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">أجر السائق</Label>
                <Input type="number" min="0" step="any" value={form.driverFee} onChange={(e) => setForm({ ...form, driverFee: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">صافي المأمورية (سعر الشركة − تكلفة السيارة − أجر السائق)</span>
              <b className={formNet < 0 ? "text-destructive" : "text-success"}>{currency(formNet)}</b>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
          </div>
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>{saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ المأمورية"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف المأمورية «{deleteTarget?.route}» وسحب ما رُحِّل منها من حساب الشركة والسيارة المستأجرة ومرتب السائق.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
