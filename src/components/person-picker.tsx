import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface PersonOption {
  value: string; // e.g. "driver:<id>"
  label: string;
  group: string; // سائق / موظف
}

/** Searchable driver / employee selector. */
export function PersonPicker({ value, options, onChange, placeholder = "اختر السائق أو الموظف" }: { value: string; options: PersonOption[]; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const groups = [...new Set(options.map((o) => o.group))];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between border-border bg-input/60 font-normal">
          <span className="truncate">{current ? `${current.label} (${current.group})` : placeholder}</span>
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" dir="rtl" align="start">
        <Command>
          <CommandInput placeholder="ابحث بالاسم..." />
          <CommandList>
            <CommandEmpty>لا يوجد اسم مطابق.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g} heading={g}>
                {options.filter((o) => o.group === g).map((o) => (
                  <CommandItem key={o.value} value={`${o.label} ${g}`} onSelect={() => { onChange(o.value); setOpen(false); }}>
                    <Check className={`ml-2 h-4 w-4 ${o.value === value ? "opacity-100" : "opacity-0"}`} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
