// Pure helpers for the student Excel/CSV importer (no I/O, fully unit-tested).

export type ImportField = "timestamp" | "name" | "studentPhone" | "parentPhone" | "route" | "pickup" | "subscription" | "amount" | "notes";

export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
  timestamp: "تاريخ التسجيل",
  name: "اسم الطالب",
  studentPhone: "هاتف الطالب",
  parentPhone: "هاتف ولي الأمر",
  route: "الخط",
  pickup: "نقطة الركوب",
  subscription: "نوع الاشتراك",
  amount: "المبلغ المدفوع",
  notes: "ملاحظات",
};

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function westernDigits(s: string) {
  return s.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ARABIC_DIGITS.indexOf(d);
    return String(i >= 0 ? i : PERSIAN_DIGITS.indexOf(d));
  });
}

/** Arabic text key: no diacritics/tatweel, unified alef/ya/ta-marbuta, single spaces. */
export function normalizeText(s: unknown): string {
  return String(s ?? "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[()\[\]:؟?،,.\-_/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizePhone(raw: unknown): string {
  let d = westernDigits(String(raw ?? "")).replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.startsWith("20") && d.length >= 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith("1")) d = `0${d}`;
  return d;
}

export function parseAmount(raw: unknown): number {
  const t = westernDigits(String(raw ?? "")).replace(/٫/g, ".").replace(/[٬,\s]/g, "");
  const m = t.match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

export function normalizeSubscription(raw: unknown): string {
  const t = normalizeText(westernDigits(String(raw ?? "")));
  if (!t) return "";
  if (/\b70\b/.test(t) || t.includes("70 رحله") || t.includes("70رحله")) return "70 رحلة";
  if (t.includes("دحيح")) return "عرض الدحيحة";
  if (t.includes("اسبوع")) return "أسبوعي";
  if (t.includes("قسط")) return "قسطين";
  if (t.includes("كامل") || t.includes("ترم")) return "سداد كامل";
  return String(raw).trim();
}

export const FULL_TERM_FEE = 13500;
export const TRIPS_70_FEE = 9500;

/** Target fee for a subscription: term/full/installments 13,500; 70 trips 9,500; Dahiha/weekly = what was paid. */
export function targetFee(type: string, amountPaid: number, routePrice = 0): number {
  if (type === "سداد كامل" || type === "قسطين") return FULL_TERM_FEE;
  if (type === "70 رحلة") return TRIPS_70_FEE;
  if (type === "عرض الدحيحة" || type === "أسبوعي") return amountPaid;
  return routePrice > 0 ? Math.max(routePrice, amountPaid) : amountPaid;
}

export const remainingBalance = (target: number, paid: number) => Math.max(0, target - paid);

/** Parses "d/m/yyyy hh:mm:ss" style stamps (Google Forms). Returns NaN when unparseable. */
export function parseStamp(raw: string): number {
  const m = westernDigits(raw).match(/(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{1,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/);
  if (!m) return NaN;
  let y: number, mo: number, d: number;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (m[1]!.length === 4) [y, mo, d] = [a, b, c];
  else {
    y = c < 100 ? 2000 + c : c;
    if (a > 12) [d, mo] = [a, b];
    else if (b > 12) [mo, d] = [a, b];
    else [d, mo] = [a, b];
  }
  let h = Number(m[4] ?? 0);
  const ap = m[7]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return Date.UTC(y, mo - 1, d, h, Number(m[5] ?? 0), Number(m[6] ?? 0));
}

export type ColumnMap = Partial<Record<ImportField, string[]>>;

/** Detect which header(s) feed each field. `pickup` may be fed by several sub-route columns. */
export function mapColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const add = (f: ImportField, h: string) => {
    (map[f] ??= []).push(h);
  };
  for (const h of headers) {
    const n = normalizeText(h);
    if (!n) continue;
    if (n.includes("ولي")) add("parentPhone", h);
    else if ((n.includes("رقم") || n.includes("واتس") || n.includes("هاتف") || n.includes("موبايل")) && n.includes("طالب")) add("studentPhone", h);
    else if (n.includes("اسم") && n.includes("طالب")) add("name", h);
    else if (n.includes("نقطه") || n.includes("نقاط") || n.includes("الركوب")) add("pickup", h);
    else if (n === "الخط" || n.startsWith("الخط ") || n === "خط" || n.includes("خط السير")) add("route", h);
    else if (n.includes("الاختيار من الاتي") || n.includes("نوع الاشتراك") || n.includes("طريقه السداد")) add("subscription", h);
    else if (n.includes("المبلغ") && (n.includes("مدفوع") || n.includes("المسدد"))) add("amount", h);
    else if (n.includes("ملاحظات") || n.includes("ملاحظه")) add("notes", h);
  }
  for (const h of headers) {
    const n = normalizeText(h);
    if (n === "timestamp" || n.includes("الطابع الزمني") || n.includes("طابع زمني")) add("timestamp", h);
  }
  if (!map.name) {
    const h = headers.find((x) => normalizeText(x) === "الاسم" || normalizeText(x) === "اسم");
    if (h) add("name", h);
  }
  return map;
}

export interface ParsedStudent {
  rowNum: number;
  name: string;
  studentPhone: string;
  parentPhone: string;
  routeName: string;
  pickupPoint: string;
  subscriptionType: string;
  amountPaid: number;
  notes: string;
  /** epoch ms of the submission, NaN when the sheet has no usable timestamp */
  stamp: number;
  /** row mentions a refund anywhere (notes, status, any column) */
  refund: boolean;
}

export const isRefundText = (v: unknown) => {
  const t = normalizeText(v);
  return t.includes("استرداد") || t.includes("مسترد");
};

const firstFilled = (row: Record<string, unknown>, headers: string[] | undefined) => {
  for (const h of headers ?? []) {
    const v = String(row[h] ?? "").trim();
    if (v) return v;
  }
  return "";
};

export function parseStudentRows(rows: Record<string, unknown>[], map: ColumnMap): ParsedStudent[] {
  return rows
    .map((r, i) => ({
      rowNum: i + 2,
      name: firstFilled(r, map.name).replace(/\s+/g, " "),
      studentPhone: normalizePhone(firstFilled(r, map.studentPhone)),
      parentPhone: normalizePhone(firstFilled(r, map.parentPhone)),
      routeName: firstFilled(r, map.route).replace(/\s+/g, " "),
      pickupPoint: firstFilled(r, map.pickup),
      subscriptionType: normalizeSubscription(firstFilled(r, map.subscription)),
      amountPaid: parseAmount(firstFilled(r, map.amount)),
      notes: firstFilled(r, map.notes),
      stamp: parseStamp(firstFilled(r, map.timestamp)),
      refund: Object.values(r).some(isRefundText),
    }))
    .filter((s) => s.name || s.studentPhone || s.parentPhone || s.routeName);
}

export type RowStatus = "valid" | "duplicate" | "superseded" | "refund" | "invalid";

export interface ReviewedStudent extends ParsedStudent {
  status: RowStatus;
  reason: string;
  newRoute: boolean;
  routeId: string | null;
  target: number;
  remaining: number;
}

export interface ExistingStudent {
  name: string;
  phone: string | null;
}
export interface ExistingRoute {
  id: string;
  name: string;
}

export function matchRoute(routeName: string, routes: ExistingRoute[]): ExistingRoute | null {
  const k = normalizeText(routeName);
  if (!k) return null;
  return routes.find((r) => normalizeText(r.name) === k) ?? null;
}

export function reviewStudents(parsed: ParsedStudent[], existing: ExistingStudent[], routes: ExistingRoute[]): ReviewedStudent[] {
  const phones = new Set(existing.map((e) => normalizePhone(e.phone)).filter(Boolean));
  const names = new Set(existing.map((e) => normalizeText(e.name)).filter(Boolean));
  const routePrice = new Map<string, number>();
  const make = (p: ParsedStudent, status: RowStatus, reason: string): ReviewedStudent => {
    const route = matchRoute(p.routeName, routes);
    const target = targetFee(p.subscriptionType, p.amountPaid, route ? routePrice.get(route.id) ?? 0 : 0);
    return { ...p, status, reason, newRoute: !!p.routeName && !route, routeId: route?.id ?? null, target, remaining: remainingBalance(target, p.amountPaid) };
  };

  // 1) refunds are dropped; 2) within the file keep only the latest submission per phone / name
  const result = new Map<number, ReviewedStudent>();
  const keptByPhone = new Map<string, number>();
  const keptByName = new Map<string, number>();
  const order = parsed
    .map((p, i) => ({ p, i }))
    .sort((x, y) => {
      const sx = Number.isNaN(x.p.stamp) ? -Infinity : x.p.stamp;
      const sy = Number.isNaN(y.p.stamp) ? -Infinity : y.p.stamp;
      return sx === sy ? x.i - y.i : sx < sy ? -1 : 1;
    });
  for (const { p, i } of order) {
    if (p.refund) { result.set(i, make(p, "refund", "حالة استرداد — مستبعد")); continue; }
    if (!p.name) { result.set(i, make(p, "invalid", "اسم الطالب مفقود")); continue; }
    const nk = normalizeText(p.name);
    const prev = (p.studentPhone ? keptByPhone.get(p.studentPhone) : undefined) ?? keptByName.get(nk);
    if (prev !== undefined) {
      const old = result.get(prev)!;
      result.set(prev, { ...old, status: "superseded", reason: "تم استبداله بتسجيل أحدث لنفس الطالب" });
    }
    result.set(i, make(p, "valid", ""));
    if (p.studentPhone) keptByPhone.set(p.studentPhone, i);
    keptByName.set(nk, i);
  }

  // 3) already registered in the system
  return parsed.map((_, i) => {
    const r = result.get(i)!;
    if (r.status !== "valid") return r;
    if (r.studentPhone && phones.has(r.studentPhone)) return { ...r, status: "duplicate" as const, reason: "هاتف الطالب مسجل مسبقًا" };
    if (names.has(normalizeText(r.name))) return { ...r, status: "duplicate" as const, reason: "الاسم مسجل مسبقًا" };
    return r;
  });
}

export interface ImportSummary {
  approved: number;
  collected: number;
  remaining: number;
}

export function summarizeImport(rows: ReviewedStudent[]): ImportSummary {
  const ok = rows.filter((r) => r.status === "valid");
  return {
    approved: ok.length,
    collected: ok.reduce((s, r) => s + r.amountPaid, 0),
    remaining: ok.reduce((s, r) => s + r.remaining, 0),
  };
}

/** total_amount to store = the target fee (route price only for unknown subscription types). */
export function subscriptionTotal(s: Pick<ParsedStudent, "subscriptionType" | "amountPaid">, routePrice: number) {
  return targetFee(s.subscriptionType, s.amountPaid, routePrice);
}
