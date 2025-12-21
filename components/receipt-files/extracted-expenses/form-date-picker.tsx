"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function formatDate(date: Date | undefined) {
  if (!date) return ""
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function isValidDate(date: Date | undefined) {
  return !!date && !isNaN(date.getTime())
}

type Props = {
  label: string
  value: string | null
  onChange: (value: string | null) => void
}

export function FormDatePickerInput({
  label,
  value,
  onChange,
}: Props) {
  const date = value ? new Date(value) : undefined

  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState<Date | undefined>(date)
  const [textValue, setTextValue] = React.useState(formatDate(date))

  React.useEffect(() => {
    setTextValue(formatDate(date))
    setMonth(date)
  }, [value])

  return (
    <div className="flex flex-col gap-3">
      <Label className="px-1">{label}</Label>

      <div className="relative flex gap-2">
        <Input
          value={textValue}
          placeholder="June 01, 2025"
          className="bg-background pr-10"
          onChange={(e) => {
            const parsed = new Date(e.target.value)
            setTextValue(e.target.value)

            if (isValidDate(parsed)) {
              onChange(parsed.toISOString())
              setMonth(parsed)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setOpen(true)
            }
          }}
        />

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
            >
              <CalendarIcon className="size-3.5" />
              <span className="sr-only">Select date</span>
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="w-auto overflow-hidden p-0"
            align="end"
            alignOffset={-8}
            sideOffset={10}
          >
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              month={month}
              onMonthChange={setMonth}
              onSelect={(d) => {
                onChange(d ? d.toISOString() : null)
                setTextValue(formatDate(d))
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
