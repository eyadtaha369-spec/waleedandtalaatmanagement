import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_SOURCES } from "@/lib/queries";

/** طريقة الدفع / مصدر التمويل — shared by every expense-generating form. */
export function PaymentSourceSelect({ value, onChange, label = "طريقة الدفع / مصدر التمويل" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const legacy = value && !(PAYMENT_SOURCES as readonly string[]).includes(value) ? value : null;
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label} *</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر" /></SelectTrigger>
        <SelectContent>
          {PAYMENT_SOURCES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          {legacy && <SelectItem value={legacy}>{legacy}</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );
}
