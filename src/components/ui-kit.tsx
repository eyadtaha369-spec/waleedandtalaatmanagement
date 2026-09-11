import { Download, Printer, Search } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gold-gradient sm:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? (
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <span className="h-4 w-1 rounded-full bg-primary" />
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-gold-gradient">{value}</p>
          {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="rounded-xl border border-primary/40 bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </span>
      </div>
    </div>
  );
}

const pillTones: Record<string, string> = {
  good: "border-success/40 bg-success/15 text-success",
  warn: "border-warning/40 bg-warning/15 text-warning",
  bad: "border-destructive/40 bg-destructive/15 text-destructive",
  info: "border-primary/40 bg-primary/10 text-primary",
  muted: "border-border bg-muted/40 text-muted-foreground",
};

export function StatusPill({ label, tone = "info" }: { label: string; tone?: keyof typeof pillTones }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold", pillTones[tone])}>
      {label}
    </span>
  );
}

export function Toolbar({
  query,
  onQuery,
  placeholder = "ابحث بكود الأتوبيس أو الاسم...",
  onExport,
  extra,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder?: string;
  onExport: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="border-border bg-input/60 pr-9 text-foreground placeholder:text-muted-foreground"
        />
      </div>
      {extra}
      <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={onExport}>
        <Download className="ml-2 h-4 w-4" /> تصدير إلى Excel
      </Button>
      <Button
        variant="outline"
        className="border-border text-foreground hover:bg-accent"
        onClick={() => window.print()}
      >
        <Printer className="ml-2 h-4 w-4" /> طباعة التقرير
      </Button>
    </div>
  );
}

export function exportToExcel(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-right text-sm">
        <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
