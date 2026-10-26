import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bus, FileText, MapPin, Pencil, Plus, Printer, Receipt, Trash2 } from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatCard, Toolbar, exportToExcel } from "@/components/ui-kit";
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
import {
  fetchClients,
  addClientTreasuryEntry,
  addClient,
  updateClient,
  deleteClient,
  fetchClientInvoiceRows,
  fetchClientStatementExtras,
  computeClientMonthBalance,
  rangeForPreset,
  periodLabel,
  type DateRange,
  type ClientLedgerPosting,
  computeClientInvoiceSummary,
  fetchClientRoutes,
  addClientRoute,
  updateClientRoute,
  deleteClientRoute,
  type Client,
  type ClientInvoiceRow,
  type ClientRoute,
} from "@/lib/queries";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [{ title: "كشف حساب ومطالبات الشركات | وليد وطلعت" }],
  }),
  component: ClientsPage,
});

const dayName = (dateStr: string) => new Date(dateStr).toLocaleDateString("ar-EG", { weekday: "long" });

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", contactPerson: "", phone: "" });
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedClient, setSelectedClient] = useState("");
  const [range, setRange] = useState<DateRange>(rangeForPreset("current"));
  const [invoiceRows, setInvoiceRows] = useState<ClientInvoiceRow[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [extras, setExtras] = useState<{ opening: number; postings: ClientLedgerPosting[] }>({ opening: 0, postings: [] });

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ kind: "in" as "in" | "out", date: new Date().toISOString().slice(0, 10), amount: "", notes: "" });
  const [paySaving, setPaySaving] = useState(false);
  const submitPay = async () => {
    setPaySaving(true);
    setError(null);
    try {
      await addClientTreasuryEntry({ clientName: selectedClient, date: payForm.date, kind: payForm.kind, amount: Number(payForm.amount) || 0, notes: payForm.notes });
      setExtras(await fetchClientStatementExtras(selectedClient, range));
      setPayOpen(false);
      setPayForm({ ...payForm, amount: "", notes: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر تسجيل الحركة");
    } finally {
      setPaySaving(false);
    }
  };

  const [routesFor, setRoutesFor] = useState<Client | null>(null);
  const [clientRoutes, setClientRoutes] = useState<ClientRoute[]>([]);
  const [routeForm, setRouteForm] = useState({ id: "", routeName: "", vehicleCapacity: "" });
  const [savingRoute, setSavingRoute] = useState(false);
  const [deleteRouteTarget, setDeleteRouteTarget] = useState<ClientRoute | null>(null);

  const loadClients = async () => {
    setLoading(true);
    setError(null);
    try {
      setClients(await fetchClients());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل بيانات الشركات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!selectedClient) {
      setInvoiceRows([]);
      return;
    }
    setInvoiceLoading(true);
    fetchClientStatementExtras(selectedClient, range)
      .then(setExtras)
      .catch(() => setExtras({ opening: 0, postings: [] }));
    fetchClientInvoiceRows(selectedClient, range)
      .then(setInvoiceRows)
      .catch((e) => setError(e instanceof Error ? e.message : "تعذر تحميل كشف الحساب"))
      .finally(() => setInvoiceLoading(false));
  }, [selectedClient, range]);

  const openAdd = () => {
    setForm({ id: "", name: "", contactPerson: "", phone: "" });
    setAdding(true);
  };
  const openEdit = (c: Client) => {
    setForm({ id: c.id, name: c.name, contactPerson: c.contactPerson, phone: c.phone });
    setAdding(true);
  };
  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: form.name, contactPerson: form.contactPerson, phone: form.phone };
      if (form.id) await updateClient(form.id, payload);
      else await addClient(payload);
      await loadClients();
      setForm({ id: "", name: "", contactPerson: "", phone: "" });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ بيانات الشركة");
    } finally {
      setSaving(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClient(deleteTarget.id);
      await loadClients();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف الشركة");
    } finally {
      setDeleting(false);
    }
  };

  const openRoutes = async (c: Client) => {
    setRoutesFor(c);
    setRouteForm({ id: "", routeName: "", vehicleCapacity: "" });
    try {
      setClientRoutes(await fetchClientRoutes(c.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل خطوط الشركة");
    }
  };
  const openEditRoute = (r: ClientRoute) => {
    setRouteForm({ id: r.id, routeName: r.routeName, vehicleCapacity: String(r.vehicleCapacity) });
  };
  const submitRoute = async () => {
    if (!routesFor || !routeForm.routeName.trim()) return;
    setSavingRoute(true);
    try {
      const payload = { routeName: routeForm.routeName, vehicleCapacity: Number(routeForm.vehicleCapacity) || 0 };
      if (routeForm.id) await updateClientRoute(routeForm.id, payload);
      else await addClientRoute({ clientId: routesFor.id, ...payload });
      setClientRoutes(await fetchClientRoutes(routesFor.id));
      setRouteForm({ id: "", routeName: "", vehicleCapacity: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الخط");
    } finally {
      setSavingRoute(false);
    }
  };
  const confirmDeleteRoute = async () => {
    if (!deleteRouteTarget || !routesFor) return;
    try {
      await deleteClientRoute(deleteRouteTarget.id);
      setClientRoutes(await fetchClientRoutes(routesFor.id));
      setDeleteRouteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف الخط");
    }
  };

  const summary = computeClientInvoiceSummary(invoiceRows);
  const balance = computeClientMonthBalance(extras.opening, summary.totalDue, extras.postings);
  const printStatement = () => {
    document.body.classList.add("print-statement");
    const cleanup = () => {
      document.body.classList.remove("print-statement");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 150);
  };
  const filteredClients = clients.filter((c) => (c.name + c.phone).includes(query) || query === "");

  return (
    <AppShell>
      <PageHeader title="كشف حساب ومطالبات الشركات" subtitle="إدارة الشركات العميلة وخطوطها وكشوف الحساب الشهرية" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Tabs defaultValue="statement">
        <TabsList className="no-print mb-4 border border-border bg-secondary/50">
          <TabsTrigger value="statement">كشف الحساب الشهري</TabsTrigger>
          <TabsTrigger value="clients">إدارة الشركات والخطوط</TabsTrigger>
        </TabsList>

        <TabsContent value="statement">
          <Panel title="اختيار الشركة والشهر">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الشركة</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="border-border bg-input/60">
                    <SelectValue placeholder="اختر شركة" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DateRangeFilter value={range} onChange={setRange} />
            </div>
          </Panel>

          {selectedClient && (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard label="عدد الورديات" value={`${summary.totalShifts} وردية`} icon={Receipt} />
                <StatCard label="عدد الأتوبيسات المشتغلة" value={`${summary.totalBusesDeployed} أتوبيس`} icon={Bus} />
                <StatCard label="إجمالي المطالبة المستحقة" value={currency(summary.totalDue)} icon={FileText} />
                <StatCard label="رصيد أول المدة (مرحّل)" value={currency(balance.opening)} icon={FileText} />
                <StatCard label="إجمالي المستحق (أول المدة + المطالبات)" value={currency(balance.opening + balance.monthDues + balance.debits)} icon={FileText} />
                <StatCard label="المحصَّل (كلي / جزئي)" value={currency(balance.credits)} icon={FileText} />
                <StatCard label="المتبقي = المستحق − المحصَّل (يُرحَّل للشهر التالي)" value={currency(balance.closing)} icon={FileText} />
              </div>

              <Panel title={`كشف حساب: ${selectedClient}`} className="mt-4">
                <Toolbar
                  query=""
                  onQuery={() => {}}
                  onExport={() => exportToExcel(`كشف حساب ${selectedClient}`, invoiceRows as unknown as Record<string, string | number>[])}
                  extra={
                    <>
                      <Button className="bg-primary text-primary-foreground" onClick={() => { setPayForm({ ...payForm, kind: "in" }); setPayOpen(true); }}>
                        <Plus className="ml-2 h-4 w-4" /> تسجيل تحصيل / صرف (يُرحَّل للخزينة)
                      </Button>
                      <Button variant="outline" className="border-border" onClick={printStatement}>
                        <Printer className="ml-2 h-4 w-4" /> طباعة كشف الحساب
                      </Button>
                    </>
                  }
                />
                <DataTable head={["اليوم والتاريخ", "رقم الأتوبيس", "نوع السيارة", "اسم السائق", "الخط / الوردية", "القيمة (دائن)"]}>
                  {invoiceLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
                    </tr>
                  ) : invoiceRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">لا توجد ورديات مسجلة لهذه الشركة هذا الشهر.</td>
                    </tr>
                  ) : (
                    invoiceRows.map((r, i) => (
                      <tr key={i} className="transition-colors hover:bg-secondary/30">
                        <td className="px-4 py-3">{dayName(r.date)} — {r.date}</td>
                        <td className="px-4 py-3 font-bold text-primary">{r.busCode}</td>
                        <td className="px-4 py-3 text-xs">{r.busType}</td>
                        <td className="px-4 py-3">{r.driver}</td>
                        <td className="px-4 py-3">{r.route || "—"}</td>
                        <td className="px-4 py-3 font-bold text-success">{currency(r.amount)}</td>
                      </tr>
                    ))
                  )}
                </DataTable>
              </Panel>

              <Panel title="قيود الحساب (من الخزينة)" className="mt-4">
                <DataTable head={["التاريخ", "البيان", "مدين", "دائن"]}>
                  {extras.postings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">لا توجد قيود هذا الشهر.</td>
                    </tr>
                  ) : (
                    extras.postings.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-secondary/30">
                        <td className="px-4 py-3">{p.date}</td>
                        <td className="px-4 py-3">{p.description}</td>
                        <td className="px-4 py-3 text-destructive">{p.debit ? currency(p.debit) : "—"}</td>
                        <td className="px-4 py-3 text-success">{p.credit ? currency(p.credit) : "—"}</td>
                      </tr>
                    ))
                  )}
                </DataTable>
              </Panel>
            </>
          )}
        </TabsContent>

        <TabsContent value="clients">
          <Panel title="الشركات العميلة">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الشركة أو الهاتف..."
              onExport={() => exportToExcel("الشركات", filteredClients as unknown as Record<string, string | number>[])}
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAdd}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة شركة
                </Button>
              }
            />
            <DataTable head={["اسم الشركة", "مسؤول التواصل", "الهاتف", "الإجراءات"]}>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">لا توجد شركات مسجلة بعد.</td>
                </tr>
              ) : (
                filteredClients.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{c.name}</td>
                    <td className="px-4 py-3">{c.contactPerson || "—"}</td>
                    <td className="px-4 py-3">{c.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openRoutes(c)}>
                          <MapPin className="ml-2 h-4 w-4" /> الخطوط المسجلة
                        </Button>
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(c)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </Panel>
        </TabsContent>
      </Tabs>

      {selectedClient && (
        <div className="print-only stmt-print" dir="rtl">
          <div className="stmt-head">
            <h1>شركة وليد وطلعت لخدمات النقل والرحلات</h1>
            <h2>كشف حساب الشركة</h2>
          </div>
          <div className="stmt-meta">
            <div><span>الشركة</span><b>{selectedClient}</b></div>
            <div><span>الفترة المالية</span><b>{periodLabel(range)}</b></div>
            <div><span>عدد الورديات</span><b>{summary.totalShifts}</b></div>
            <div><span>عدد الأتوبيسات</span><b>{summary.totalBusesDeployed}</b></div>
          </div>
          <h3>أولًا: الورديات والمطالبات</h3>
          <table>
            <thead>
              <tr>{["م", "اليوم والتاريخ", "رقم الأتوبيس", "نوع السيارة", "اسم السائق", "الخط / الوردية", "القيمة"].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {invoiceRows.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center" }}>لا توجد ورديات في هذه الفترة</td></tr>
              ) : (
                invoiceRows.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td><td>{dayName(r.date)} — {r.date}</td><td>{r.busCode}</td><td>{r.busType}</td><td>{r.driver}</td><td>{r.route || "—"}</td><td className="num">{currency(r.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot><tr><td colSpan={6}>إجمالي المطالبة المستحقة</td><td className="num">{currency(summary.totalDue)}</td></tr></tfoot>
          </table>
          {extras.postings.length > 0 && (
            <>
              <h3>ثانيًا: قيود الحساب (تحصيلات ومدفوعات)</h3>
              <table>
                <thead><tr>{["التاريخ", "البيان", "مدين", "دائن"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {extras.postings.map((p) => (
                    <tr key={p.id}><td>{p.date}</td><td>{p.description}</td><td className="num">{p.debit ? currency(p.debit) : "—"}</td><td className="num">{p.credit ? currency(p.credit) : "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <table className="stmt-totals">
            <tbody>
              <tr><td>رصيد أول المدة (مرحّل)</td><td className="num">{currency(balance.opening)}</td></tr>
              <tr><td>مطالبات الفترة</td><td className="num">{currency(balance.monthDues)}</td></tr>
              {balance.debits > 0 && <tr><td>قيود مدينة أخرى</td><td className="num">{currency(balance.debits)}</td></tr>}
              <tr><td>إجمالي المستحق</td><td className="num">{currency(balance.opening + balance.monthDues + balance.debits)}</td></tr>
              <tr><td>المحصَّل</td><td className="num">{currency(balance.credits)}</td></tr>
              <tr className="grand"><td>المتبقي (يُرحَّل للفترة التالية)</td><td className="num">{currency(balance.closing)}</td></tr>
            </tbody>
          </table>
          <div className="stmt-foot">
            <p>تاريخ إصدار الكشف: {new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</p>
            <div className="stmt-sign">
              <span>المحاسب<i /></span>
              <span>المدير المالي<i /></span>
              <span>اعتماد الإدارة<i /></span>
            </div>
          </div>
        </div>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">تحصيل / صرف — {selectedClient}</DialogTitle>
            <DialogDescription className="text-muted-foreground">تُسجَّل الحركة في دفتر الخزينة (حساب الشركة) وتظهر فورًا في قيود كشف الحساب.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">نوع الحركة</Label>
              <Select value={payForm.kind} onValueChange={(v) => setPayForm({ ...payForm, kind: v as "in" | "out" })}>
                <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">تحصيل من الشركة (إيداع بالخزينة)</SelectItem>
                  <SelectItem value="out">صرف للشركة (سحب من الخزينة)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">التاريخ</Label>
                <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">المبلغ (ج.م)</Label>
                <Input type="number" min="0" step="any" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <p>المتبقي الحالي على الشركة: <b>{currency(balance.closing)}</b></p>
              <p>المتبقي بعد هذه الحركة: <b className="text-primary">{currency(balance.closing + (payForm.kind === "in" ? -1 : 1) * (Number(payForm.amount) || 0))}</b></p>
              <p className="mt-1 text-xs text-muted-foreground">يُرحَّل للخزينة والكشف المبلغ المدخل فقط (تحصيل جزئي مقبول)، والباقي يظل مستحقًا.</p>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitPay} disabled={paySaving}>{paySaving ? "جارِ الحفظ..." : "حفظ وترحيل للخزينة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{form.id ? "تعديل بيانات الشركة" : "إضافة شركة جديدة"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات الشركة العميلة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["name", "اسم الشركة"],
              ["contactPerson", "مسؤول التواصل"],
              ["phone", "الهاتف", "tel"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>
              {saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ الشركة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!routesFor} onOpenChange={(o) => !o && setRoutesFor(null)}>
        <DialogContent className="glass max-h-[85vh] overflow-y-auto text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">الخطوط المسجلة: {routesFor?.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">خطوط هذه الشركة وسعة العربية المخصصة لكل خط</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {clientRoutes.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">لا توجد خطوط مسجلة لهذه الشركة بعد.</p>
            ) : (
              clientRoutes.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                  <div>
                    <p className="text-sm font-bold">{r.routeName}</p>
                    <p className="text-xs text-muted-foreground">السعة: {r.vehicleCapacity} راكب</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditRoute(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteRouteTarget(r)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2 border-t border-border pt-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">اسم الخط</Label>
              <Input value={routeForm.routeName} onChange={(e) => setRouteForm({ ...routeForm, routeName: e.target.value })} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">السعة</Label>
              <Input value={routeForm.vehicleCapacity} onChange={(e) => setRouteForm({ ...routeForm, vehicleCapacity: e.target.value })} type="number" className="w-24 border-border bg-input/60" />
            </div>
            <Button className="bg-primary text-primary-foreground" onClick={submitRoute} disabled={savingRoute}>
              {routeForm.id ? "حفظ" : "إضافة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف شركة {deleteTarget?.name} نهائيًا. لا يمكن التراجع عن هذا الإجراء.
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

      <AlertDialog open={!!deleteRouteTarget} onOpenChange={(o) => !o && setDeleteRouteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">حذف الخط؟</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف خط {deleteRouteTarget?.routeName} نهائيًا.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeleteRoute}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
