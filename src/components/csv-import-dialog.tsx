import { useState } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CsvColumn {
  key: string;
  label: string;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  title,
  columns,
  onImport,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  columns: CsvColumn[];
  onImport: (rows: Record<string, string>[]) => Promise<number>;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    setResult(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length > 0) {
          setError("تعذرت قراءة الملف بشكل صحيح — تأكد أنه CSV سليم");
          setRows([]);
        } else {
          setRows(res.data);
        }
      },
      error: () => setError("تعذرت قراءة الملف"),
    });
  };

  const downloadTemplate = () => {
    const csv = columns.map((c) => c.key).join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const count = await onImport(rows);
      setResult(`تم استيراد ${count} سجل بنجاح`);
      setRows([]);
      setFileName("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر استيراد البيانات");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass text-foreground" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-primary">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            ملف CSV بترويسة تطابق الأعمدة المطلوبة — يمكنك تنزيل نموذج فارغ أدناه
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-secondary/25 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-bold text-foreground">الأعمدة المتوقعة:</p>
          <p dir="ltr" className="text-left font-mono">
            {columns.map((c) => c.key).join(", ")}
          </p>
          <button onClick={downloadTemplate} className="mt-2 text-primary hover:underline">
            تنزيل نموذج CSV فارغ
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}
        {result && (
          <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary">{result}</p>
        )}

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary">
          <Upload className="h-4 w-4" />
          {fileName || "اختر ملف CSV"}
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>

        {rows.length > 0 && (
          <p className="text-xs text-muted-foreground">تم العثور على {rows.length} سجل جاهز للاستيراد</p>
        )}

        <DialogFooter>
          <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={rows.length === 0 || importing}>
            {importing ? "جارِ الاستيراد..." : `استيراد ${rows.length || ""} سجل`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
