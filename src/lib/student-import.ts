// Pure helpers for the student Excel/CSV importer (no I/O, fully unit-tested).

export type ImportField = "name" | "studentPhone" | "parentPhone" | "route" | "pickup" | "subscription" | "amount" | "notes";

export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
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
  const t = normalizeText(raw);
  if (!t) return "";
  if (t.includes("كامل")) return "سداد كامل";
  if (t.includes("دحيح")) return "عرض الدحيحة";
  if (t.includes("قسط")) return "قسطين";
  return String(raw).trim();
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
}

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
    }))
    .filter((s) => s.name || s.studentPhone || s.parentPhone || s.routeName);
}

export type RowStatus = "valid" | "duplicate" | "invalid";

export interface ReviewedStudent extends ParsedStudent {
  status: RowStatus;
  reason: string;
  newRoute: boolean;
  routeId: string | null;
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
  const seenPhones = new Set<string>();
  const seenNames = new Set<string>();
  return parsed.map((p) => {
    const route = matchRoute(p.routeName, routes);
    const base = { ...p, newRoute: !!p.routeName && !route, routeId: route?.id ?? null };
    if (!p.name) return { ...base, status: "invalid" as const, reason: "اسم الطالب مفقود" };
    const nk = normalizeText(p.name);
    let reason = "";
    if (p.studentPhone && (phones.has(p.studentPhone) || seenPhones.has(p.studentPhone))) reason = "هاتف الطالب مسجل مسبقًا";
    else if (names.has(nk) || seenNames.has(nk)) reason = "الاسم مسجل مسبقًا";
    if (p.studentPhone) seenPhones.add(p.studentPhone);
    seenNames.add(nk);
    return reason ? { ...base, status: "duplicate" as const, reason } : { ...base, status: "valid" as const, reason: "" };
  });
}

/** total_amount to store: route price when known, full payment = what was paid, otherwise unknown (0). */
export function subscriptionTotal(s: Pick<ParsedStudent, "subscriptionType" | "amountPaid">, routePrice: number) {
  if (routePrice > 0) return Math.max(routePrice, s.amountPaid);
  return s.subscriptionType === "سداد كامل" ? s.amountPaid : 0;
}
