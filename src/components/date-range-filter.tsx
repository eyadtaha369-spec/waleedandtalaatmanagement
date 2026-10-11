import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rangeForPreset, type DateRange, type RangePreset } from "@/lib/queries";
import { cn } from "@/lib/utils";

const presets: { key: RangePreset; label: string }[] = [
  { key: "current", label: "الشهر الحالي" },
  { key: "previous", label: "الشهر السابق" },
  { key: "all", label: "الكل" },
];

/** From/To date picker with quick presets. Used by every statement screen. */
export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  className?: string;
}) {
  const same = (a: DateRange, b: DateRange) => a.from === b.from && a.to === b.to;
  return (
    <div className={cn("no-print flex flex-wrap items-end gap-3", className)}>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">من تاريخ</Label>
        <Input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className="h-9 w-40 border-border bg-input/60" />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">إلى تاريخ</Label>
        <Input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className="h-9 w-40 border-border bg-input/60" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Button
            key={p.key}
            type="button"
            size="sm"
            variant={same(value, rangeForPreset(p.key)) ? "default" : "outline"}
            className={same(value, rangeForPreset(p.key)) ? "" : "border-border"}
            onClick={() => onChange(rangeForPreset(p.key))}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
