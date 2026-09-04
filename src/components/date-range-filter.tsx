"use client";

import { RANGE_PRESETS, toInputDate, type DateRange } from "@/lib/dates";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function DateRangeFilter({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange(preset.get())}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="from">Dal</Label>
          <Input
            id="from"
            type="date"
            value={toInputDate(range.from)}
            onChange={(e) =>
              onChange({ from: new Date(`${e.target.value}T00:00:00`), to: range.to })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">Al</Label>
          <Input
            id="to"
            type="date"
            value={toInputDate(range.to)}
            onChange={(e) =>
              onChange({ from: range.from, to: new Date(`${e.target.value}T23:59:59`) })
            }
          />
        </div>
      </div>
    </div>
  );
}
