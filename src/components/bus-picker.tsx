import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { busOptionLabel } from "@/lib/queries";
import type { Bus } from "@/lib/fleet-data";

/**
 * Searchable bus selector. The label leads with the license plate ("رقم اللوحة - النوع / الموديل");
 * typing searches by plate, code, type or model. `by` decides whether the value is the bus code or its id.
 */
export function BusPicker({
  value,
  buses,
  onChange,
  by = "code",
  placeholder = "اختر العربية (رقم اللوحة)",
  allowNone = false,
}: {
  value: string;
  buses: Bus[];
  onChange: (value: string) => void;
  by?: "code" | "id";
  placeholder?: string;
  allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const key = (b: Bus) => (by === "id" ? b.id : b.code);
  const current = buses.find((b) => key(b) === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between border-border bg-input/60 font-normal">
          <span className="truncate">{current ? busOptionLabel(current) : placeholder}</span>
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" dir="rtl" align="start">
        <Command>
          <CommandInput placeholder="ابحث برقم اللوحة..." />
          <CommandList>
            <CommandEmpty>لا توجد عربية بهذا الرقم.</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem value="__none بدون تحديد" onSelect={() => { onChange(""); setOpen(false); }}>
                  بدون تحديد
                </CommandItem>
              )}
              {buses.map((b) => (
                <CommandItem
                  key={b.id}
                  value={`${b.plate} ${b.code} ${b.busType} ${b.model}`}
                  onSelect={() => {
                    onChange(key(b));
                    setOpen(false);
                  }}
                >
                  <Check className={`ml-2 h-4 w-4 ${key(b) === value ? "opacity-100" : "opacity-0"}`} />
                  {busOptionLabel(b)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
