'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface PickerOption {
  id: string;
  name: string;
  phone: string | null;
}

/** Searchable sponsor list: type part of a name or phone number. */
export function SponsorPicker({ options, value, onChange, placeholder }: {
  options: PickerOption[]; value: string; onChange: (id: string) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const label = (o: PickerOption) => (o.phone ? `${o.name} – ${o.phone}` : o.name);

  return (
    // modal: lets the list scroll inside the Record Donation dialog
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected ? label(selected) : placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <Command filter={(itemValue, search) => {
          const q = search.trim().toLowerCase();
          return itemValue.toLowerCase().includes(q) || itemValue.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000') ? 1 : 0;
        }}>
          <CommandInput placeholder="Search by name or phone…" />
          <CommandList>
            <CommandEmpty>No sponsor found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.id} value={`${o.name} ${o.phone || ''} ${o.id}`} onSelect={() => { onChange(o.id); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === o.id ? 'opacity-100' : 'opacity-0')} />
                  {label(o)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
