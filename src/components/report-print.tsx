import { periodLabel, type DateRange } from "@/lib/queries";

/** ورقة طباعة رسمية موحّدة (ترويسة + فترة + جدول + إجماليات + توقيعات). تظهر عند الطباعة فقط. */
export function ReportPrint({
  title,
  range,
  columns,
  rows,
  footer,
  summary,
}: {
  title: string;
  range: DateRange;
  columns: string[];
  rows: (string | number)[][];
  footer?: (string | number)[];
  summary?: [string, string][];
}) {
  const from = range.from || "البداية";
  const to = range.to || "اليوم";
  return (
    <div className="print-only stmt-print" dir="rtl">
      <div className="stmt-head">
        <h1>شركة وليد وطلعت لخدمات النقل والرحلات</h1>
        <h2>{title}</h2>
      </div>
      <div className="stmt-meta">
        <div><span>الفترة</span><b>{periodLabel(range)}</b></div>
        <div><span>من تاريخ / إلى تاريخ</span><b>{from} — {to}</b></div>
      </div>
      <table>
        <thead>
          <tr>{columns.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length}>لا توجد بيانات في هذه الفترة</td></tr>
          ) : (
            rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)
          )}
        </tbody>
        {footer && (
          <tfoot>
            <tr>{footer.map((c, j) => <td key={j}>{c}</td>)}</tr>
          </tfoot>
        )}
      </table>
      {summary && (
        <table className="stmt-totals">
          <tbody>
            {summary.map(([l, v]) => (
              <tr key={l}><td>{l}</td><td className="num">{v}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="stmt-foot">
        <p>تاريخ إصدار التقرير: {new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</p>
        <div className="stmt-sign">
          <span>أمين المخزن / مسؤول الورشة<i /></span>
          <span>المحاسب<i /></span>
          <span>اعتماد الإدارة<i /></span>
        </div>
      </div>
    </div>
  );
}
