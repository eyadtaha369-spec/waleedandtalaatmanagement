import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PaymentSourceSelect } from "@/components/payment-source-select";
import { DataTable, Panel } from "@/components/ui-kit";
import {
  PAY_FROM_OPTIONS,
  addSubscriptionExpense,
  deleteSubscriptionExpense,
  updateSubscriptionExpense,
  type SubscriptionExpense,
} from "@/lib/queries";
import { currency } from "@/lib/fleet-data";

const today = () => new Date().toISOString().slice(0, 10);
const NONE = "__none__";
const emptyForm = () => ({ id: "", date: today(), description: "", routeName: NONE, amount: "", payFrom: "الخزينة الرئيسية (من الجيب / النقدية)", notes: "" });
const SUGGESTIONS = ["صيانة أتوبيسات طلاب", "كروت طرق", "بنزين", "رواتب مشرفين"];

export function SubscriptionExpensesPanel({ expenses, routeNames, onChanged }: { expenses: SubscriptionExpense[]; routeNames: string[]; onChanged: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<SubscriptionExpense | null>(null);

  const openNew = () => {
    setForm(emptyForm());
    setError("");
    setOpen(true);
  };
  const openEdit = (e: SubscriptionExpense) => {
    setForm({ id: e.id, date: e.date, description: e.description, routeName: e.routeName || NONE, amount: String(e.amount), payFrom: e.payFrom || "الخزينة الرئيسية (من الجيب / النقدية)", notes: e.notes });
    setError("");
    setOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const input = { date: form.date, description: form.description, routeName: form.routeName === NONE ? "" : form.routeName, amount: Number(form.amount) || 0, payFrom: form.payFrom, notes: form.notes };
      if (form.id) await updateSubscriptionExpense(form.id, input);
      else await addSubscriptionExpense(input);
      setOpen(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ المصروف");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!target) return;
    try {
      await deleteSubscriptionExpense(target.id);
      setTarget(null);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف المصروف");
      setTarget(null);
    }
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <Panel
      title="مصروفات الاشتراكات والخطوط"
      action={
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openNew}>
          <Plus className="ml-2 h-4 w-4" /> إضافة مصروف اشتراكات
        </Button>
      }
    >
      {error && !open && <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
      <DataTable head={["التاريخ", "بيان المصروف", "الخط / الشركة", "المبلغ", "طريقة الصرف", "ملاحظات", "الإجراءات"]}>
        {expenses.length === 0 ? (
          <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">لا توجد مصروفات اشتراكات مسجلة بعد.</td></tr>
        ) : (
          expenses.map((e) => (
            <tr key={e.id} className="transition-colors hover:bg-secondary/30">
              <td className="px-4 py-3">{e.date}</td>
              <td className="px-4 py-3 font-bold">{e.description}</td>
              <td className="px-4 py-3">{e.routeName || "—"}</td>
              <td className="px-4 py-3 font-bold text-destructive">{currency(e.amount)}</td>
              <td className="px-4 py-3">{e.payFrom}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.notes || "—"}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setTarget(e)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </td>
            </tr>
          ))
        )}
      </DataTable>
      {expenses.length > 0 && <p className="mt-3 text-sm font-bold">إجمالي المصروفات: <span className="text-destructive">{currency(total)}</span></p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{form.id ? "تعديل مصروف اشتراكات" : "إضافة مصروف اشتراكات"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">يُسجَّل المصروف تلقائيًا كسحب من الخزينة المختارة.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">التاريخ</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">المبلغ (EGP)</Label>
                <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">بيان المصروف</Label>
              <Input list="sub-exp-suggestions" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: صيانة أتوبيسات طلاب" className="border-border bg-input/60" />
              <datalist id="sub-exp-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الخط / الشركة (اختياري)</Label>
                <Select value={form.routeName} onValueChange={(v) => setForm({ ...form, routeName: v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>بدون خط محدد</SelectItem>
                    {routeNames.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <PaymentSourceSelect value={form.payFrom} onChange={(v) => setForm({ ...form, payFrom: v })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>{saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ المصروف"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">سيتم حذف المصروف «{target?.description}» وحركة السحب المرتبطة به من الخزينة.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={remove}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
