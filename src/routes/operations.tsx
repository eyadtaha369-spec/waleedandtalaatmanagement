import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { currency, type Student } from "@/lib/fleet-data";
import {
  fetchStudents,
  fetchPaymentHistory,
  addPayment,
  addStudent as addStudentApi,
  updateStudent,
  deleteStudent,
  bulkInsertStudents,
} from "@/lib/queries";
import { CsvImportDialog } from "@/components/csv-import-dialog";

export const Route = createFileRoute("/operations")({
  head: () => ({
    meta: [
      { title: "الطلاب والاشتراكات | وليد وطلعت" },
      { name: "description", content: "إدارة اشتراكات الطلاب وحالات السداد." },
      { property: "og:title", content: "الطلاب والاشتراكات | وليد وطلعت" },
      { property: "og:description", content: "بيانات الطلاب المشتركين والاشتراكات وحالة السداد." },
    ],
  }),
  component: OperationsPage,
});

function OperationsPage() {
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<{ date: string; amount: number; method: string }[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({ id: "", name: "", guardianPhone: "", routeName: "", monthly: "" });
  const [importingStudents, setImportingStudents] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      setStudentsList(await fetchStudents());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (student) {
      fetchPaymentHistory(student.id).then(setPayments).catch(() => setPayments([]));
    }
  }, [student]);

  const filteredStudents = useMemo(
    () => studentsList.filter((s) => (s.name + s.route).includes(query) || query === ""),
    [studentsList, query],
  );

  const recordPayment = async () => {
    if (!student || !payAmount.trim()) return;
    setSaving(true);
    try {
      await addPayment(student.id, Number(payAmount) || 0, payMethod || "نقدي");
      const [refreshed, refreshedStudents] = await Promise.all([fetchPaymentHistory(student.id), fetchStudents()]);
      setPayments(refreshed);
      setStudentsList(refreshedStudents);
      setPayAmount("");
      setPayMethod("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل الدفعة");
    } finally {
      setSaving(false);
    }
  };

  const openAddStudent = () => {
    setStudentForm({ id: "", name: "", guardianPhone: "", routeName: "", monthly: "" });
    setAddingStudent(true);
  };

  const openEditStudent = (s: Student) => {
    setStudentForm({ id: s.id, name: s.name, guardianPhone: s.guardianPhone === "—" ? "" : s.guardianPhone, routeName: s.route === "—" ? "" : s.route, monthly: String(s.monthly) });
    setAddingStudent(true);
  };

  const submitStudent = async () => {
    if (!studentForm.name.trim()) return;
    setSaving(true);
    try {
      if (studentForm.id) {
        await updateStudent(studentForm.id, { name: studentForm.name, guardianPhone: studentForm.guardianPhone, routeName: studentForm.routeName });
      } else {
        await addStudentApi({ name: studentForm.name, guardianPhone: studentForm.guardianPhone, routeName: studentForm.routeName, monthly: Number(studentForm.monthly) || 0 });
      }
      await loadAll();
      setStudentForm({ id: "", name: "", guardianPhone: "", routeName: "", monthly: "" });
      setAddingStudent(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الطالب");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStudent(deleteTarget.id);
      await loadAll();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف الطالب");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="الطلاب والاشتراكات" subtitle="اشتراكات الطلاب وحالة السداد" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Panel title="اشتراكات الطلاب">
        <Toolbar
          query={query}
          onQuery={setQuery}
          placeholder="ابحث باسم الطالب أو الخط..."
          onExport={() => exportToExcel("الاشتراكات", filteredStudents as unknown as Record<string, string | number>[])}
          extra={
            <>
              <Button variant="outline" className="border-border" onClick={() => setImportingStudents(true)}>
                استيراد CSV
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddStudent}>
                <Plus className="ml-2 h-4 w-4" /> إضافة طالب
              </Button>
            </>
          }
        />
        <DataTable head={["الطالب", "الخط", "هاتف ولي الأمر", "الاشتراك الشهري", "المسدد", "المتبقي", "الحالة", "الإجراءات"]}>
          {loading ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
            </tr>
          ) : (
            filteredStudents.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3 font-bold">{s.name}</td>
                <td className="px-4 py-3">{s.route}</td>
                <td className="px-4 py-3">{s.guardianPhone}</td>
                <td className="px-4 py-3">{currency(s.monthly)}</td>
                <td className="px-4 py-3">{currency(s.paid)}</td>
                <td className="px-4 py-3 text-warning">{currency(s.monthly - s.paid)}</td>
                <td className="px-4 py-3">
                  <StatusPill
                    label={s.status}
                    tone={s.status === "خالص" ? "good" : s.status === "أقساط" ? "warn" : "bad"}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => setStudent(s)}>
                      المدفوعات
                    </Button>
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditStudent(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(s)}
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

      <Dialog open={!!student} onOpenChange={(o) => !o && setStudent(null)}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">سجل مدفوعات: {student?.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">تفاصيل الأقساط والمبالغ المسددة</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {payments.length === 0 ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                لا توجد مدفوعات مسجلة لهذا الشهر.
              </p>
            ) : (
              payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                  <span>{p.date}</span>
                  <span className="font-bold text-primary">{currency(p.amount)}</span>
                  <span className="text-muted-foreground">{p.method}</span>
                </div>
              ))
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">المبلغ</Label>
              <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} type="number" className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
              <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={recordPayment} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "تسجيل دفع قسط جديد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingStudent} onOpenChange={setAddingStudent}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{studentForm.id ? "تعديل بيانات الطالب" : "إضافة طالب جديد"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات الطالب والاشتراك</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {(studentForm.id
              ? [["name", "اسم الطالب"], ["guardianPhone", "هاتف ولي الأمر", "tel"], ["routeName", "اسم الخط"]]
              : [["name", "اسم الطالب"], ["guardianPhone", "هاتف ولي الأمر", "tel"], ["routeName", "اسم الخط"], ["monthly", "الاشتراك الشهري", "number"]]
            ).map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={studentForm[key as keyof typeof studentForm]}
                  onChange={(e) => setStudentForm({ ...studentForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
            {studentForm.id && (
              <p className="text-xs text-muted-foreground">
                لتعديل الاشتراك الشهري أو المبالغ المسددة استخدم "المدفوعات" أو صفحة كشف الحساب — التعديل هنا للبيانات الأساسية فقط.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitStudent} disabled={saving}>
              {saving ? "جارِ الحفظ..." : studentForm.id ? "حفظ التعديلات" : "حفظ الطالب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={importingStudents}
        onOpenChange={setImportingStudents}
        title="استيراد الطلاب من CSV"
        columns={[
          { key: "name", label: "الاسم" },
          { key: "parent_phone", label: "هاتف ولي الأمر" },
          { key: "route_name", label: "اسم الخط" },
          { key: "total_amount", label: "الاشتراك الشهري" },
          { key: "paid_amount", label: "المسدد" },
        ]}
        onImport={bulkInsertStudents}
        onDone={loadAll}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف الطالب {deleteTarget?.name} نهائيًا. لا يمكن التراجع عن هذا الإجراء.
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
