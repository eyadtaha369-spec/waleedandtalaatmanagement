import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Client } from "@/lib/queries";

/** Searchable client list that also accepts a free-typed account name. */
export function AccountPicker({
  value,
  clients,
  onPick,
  placeholder = "ابحث عن شركة أو اكتب اسمًا...",
}: {
  value: string;
  clients: Client[];
  onPick: (name: string, clientId: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const typed = text.trim();
  const exact = clients.some((c) => c.name === typed);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between border-border bg-input/60 font-normal">
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" dir="rtl" align="start">
        <Command>
          <CommandInput placeholder="ابحث أو اكتب اسمًا جديدًا..." value={text} onValueChange={setText} />
          <CommandList>
            <CommandEmpty>لا توجد شركة بهذا الاسم.</CommandEmpty>
            <CommandGroup>
              {typed && !exact && (
                <CommandItem
                  value={`__free ${typed}`}
                  onSelect={() => {
                    onPick(typed, "");
                    setOpen(false);
                  }}
                >
                  استخدام «{typed}» كاسم حساب
                </CommandItem>
              )}
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onPick(c.name, c.id);
                    setOpen(false);
                  }}
                >
                  <Check className={`ml-2 h-4 w-4 ${value === c.name ? "opacity-100" : "opacity-0"}`} />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

