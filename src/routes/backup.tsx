import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { exportAllData } from "@/lib/queries";

export const Route = createFileRoute("/backup")({
  head: () => ({
    meta: [{ title: "النسخ الاحتياطي | وليد وطلعت" }],
  }),
  component: BackupPage,
});

function BackupPage() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const runExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `waleedandtalaat-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLastExport(new Date().toLocaleString("ar-EG"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء النسخة الاحتياطية");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="النسخ الاحتياطي" subtitle="تنزيل نسخة كاملة من كل البيانات كملف JSON" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Panel title="تصدير نسخة احتياطية">
        <p className="mb-4 text-sm text-muted-foreground">
          يقوم هذا الزر بتنزيل نسخة كاملة من كل البيانات (الأتوبيسات، السائقون، الطلاب، الخطوط، المالية، وغيرها) كملف
          واحد يمكن حفظه على جهازك أو في مساحة تخزين سحابية. لا يغني هذا عن نسخ Supabase الاحتياطية، لكنه يعطيك نسخة
          إضافية تحت تحكمك المباشر — يُنصح بتشغيله بشكل دوري (أسبوعيًا مثلاً)، خاصة قبل أي تعديل كبير على البيانات.
        </p>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={runExport} disabled={exporting}>
          <Download className="ml-2 h-4 w-4" />
          {exporting ? "جارِ التصدير..." : "تنزيل نسخة احتياطية الآن"}
        </Button>
        {lastExport && <p className="mt-3 text-xs text-muted-foreground">آخر تصدير: {lastExport}</p>}
      </Panel>
    </AppShell>
  );
}
