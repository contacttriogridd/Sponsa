'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { astroLabel, searchText, type AstroName } from '@/lib/natchathiram';
import { cn } from '@/lib/utils';

interface AstroComboboxProps {
  id?: string;
  /** Options to offer (may be filtered). */
  items: AstroName[];
  /** Full list, so a current value outside the filtered options still shows its name. */
  all: AstroName[];
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder: string;
  /** Small text shown beside an option, e.g. "4th padam". */
  note?: (item: AstroName) => string;
}

/** Searchable Raasi / star picker: matches Tamil, English and common spellings ("punar", "புனர்"). */
export function AstroCombobox({ id, items, all, value, onChange, placeholder, note }: AstroComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = all.find((i) => i.index === value);

  return (
    // modal: lets the list scroll when the picker sits inside a dialog
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? astroLabel(selected) : placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {value != null && (
              <X
                className="h-4 w-4 opacity-60 hover:opacity-100"
                aria-label="Clear"
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <Command filter={(itemValue, search) => (itemValue.includes(search.trim().toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search in Tamil or English…" />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.index}
                  value={`${item.index} ${searchText(item)}`}
                  onSelect={() => { onChange(item.index); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === item.index ? 'opacity-100' : 'opacity-0')} />
                  <span>{astroLabel(item)}</span>
                  {note?.(item) && <span className="ml-auto pl-2 text-xs text-muted-foreground">{note(item)}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
