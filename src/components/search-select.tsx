import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** قائمة اختيار بحث فوري بالكتابة (بدل <select> العادي). القيمة = النص نفسه. */
export function SearchSelect({
  value,
  options,
  onChange,
  placeholder = "اختر",
  searchPlaceholder = "ابحث بالاسم...",
  emptyText = "لا توجد نتائج مطابقة.",
  className,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className={cn("w-full justify-between border-border bg-input/60 font-normal", className)}>
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[14rem] p-0" dir="rtl" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((o) => (
              <CommandItem key={o} value={o} onSelect={() => { onChange(o); setOpen(false); }}>
                <Check className={cn("ml-2 h-4 w-4", o === value ? "opacity-100" : "opacity-0")} />
                {o}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
