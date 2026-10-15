import * as RSelect from '@radix-ui/react-select'
import * as RSlider from '@radix-ui/react-slider'
import * as RSwitch from '@radix-ui/react-switch'
import * as RTooltip from '@radix-ui/react-tooltip'
import clsx from 'clsx'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import type { ReactNode } from 'react'

// --------------------------------------------------------------- Tooltip
export function Tip({ label, children, side = 'top', kbd }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right'; kbd?: string }) {
  return (
    <RTooltip.Root delayDuration={350}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={8}
          className="z-[70] flex items-center gap-2 rounded-lg border border-line-strong bg-[#18181c]/95 px-2.5 py-1.5 text-xs text-ink-2 shadow-xl backdrop-blur"
        >
          {label}
          {kbd && <span className="mono text-2xs text-ink-4">{kbd}</span>}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}

// --------------------------------------------------------------- Field row
export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        {hint && <span className="mono text-2xs text-ink-4">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// --------------------------------------------------------------- Select
export interface Option {
  value: string
  label: string
  hint?: string
}
export function Select({ value, onChange, options, className, disabled }: { value: string; onChange: (v: string) => void; options: Option[]; className?: string; disabled?: boolean }) {
  const current = options.find((o) => o.value === value)
  return (
    <RSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RSelect.Trigger
        className={clsx(
          'nodrag flex h-8 w-full items-center justify-between gap-2 rounded-[10px] border border-[var(--line-soft)] bg-[var(--inset-deep)] px-2.5 text-sm text-ink-2 outline-none transition hover:border-line-strong hover:bg-black/40 data-[state=open]:border-line-strong disabled:opacity-50',
          className,
        )}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-4" />
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content position="popper" sideOffset={6} className="menu min-w-[var(--radix-select-trigger-width)]">
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item key={o.value} value={o.value} className="menu-item pr-2">
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                {o.hint && <span className="kbd">{o.hint}</span>}
                <RSelect.ItemIndicator className={o.hint ? 'ml-1' : 'ml-auto'}>
                  <Check size={13} className="text-[var(--select)]" />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

// --------------------------------------------------------------- Slider
export function Slider({ value, onChange, min, max, step, color = 'var(--t-score)' }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; color?: string }) {
  return (
    <RSlider.Root
      className="nodrag relative flex h-5 w-full touch-none select-none items-center"
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
    >
      <RSlider.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-white/10">
        <RSlider.Range className="absolute h-full rounded-full" style={{ background: color }} />
      </RSlider.Track>
      <RSlider.Thumb
        className="block h-3.5 w-3.5 rounded-full border-2 border-[var(--canvas)] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_2px_8px_rgba(0,0,0,0.5)] outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/40"
        aria-label="value"
      />
    </RSlider.Root>
  )
}

// --------------------------------------------------------------- Stepper ◀ 3 ▶
export function Stepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  const btn = 'grid h-full w-7 place-items-center text-ink-4 transition hover:bg-white/5 hover:text-ink disabled:opacity-30'
  return (
    <div className="nodrag flex h-8 items-center overflow-hidden rounded-[10px] border border-[var(--line-soft)] bg-[var(--inset-deep)]">
      <button className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="decrease">
        <ChevronLeft size={14} />
      </button>
      <span className="mono flex-1 text-center text-sm text-ink">{value}</span>
      <button className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="increase">
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

// --------------------------------------------------------------- Switch
export function Switch({ checked, onChange, locked, label }: { checked: boolean; onChange?: (v: boolean) => void; locked?: boolean; label: string }) {
  return (
    <label className="nodrag flex cursor-pointer items-center justify-between gap-3 text-sm text-ink-2">
      <span className="flex items-center gap-1.5">
        {label}
        {locked && <Lock size={11} className="text-ink-4" />}
      </span>
      <RSwitch.Root
        checked={checked}
        disabled={locked}
        onCheckedChange={onChange}
        className="relative h-[18px] w-8 rounded-full bg-white/10 transition data-[state=checked]:bg-[var(--mint)] disabled:cursor-not-allowed"
      >
        <RSwitch.Thumb className="block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-[var(--mint-ink)]" />
      </RSwitch.Root>
    </label>
  )
}

// --------------------------------------------------------------- Segmented tabs
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="nodrag flex rounded-full border border-line bg-black/25 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'relative h-7 flex-1 rounded-full px-3 text-xs font-medium transition',
            value === o.value ? 'bg-white/[0.09] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-ink-4 hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Skeleton({ className, width }: { className?: string; width?: number }) {
  return <div className={clsx('shimmer', className)} style={width ? { width } : undefined} />
}
