import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn, iconSlot } from './utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp';
export type ButtonSize = 'sm' | 'md' | 'lg';

// app.html `.btn-*` — hover only applies while the button is interactive (not disabled/loading).
const VARIANT: Record<ButtonVariant, { base: string; hover: string }> = {
  primary: { base: 'bg-primary text-primary-ink', hover: 'hover:bg-primary-hover' },
  secondary: { base: 'border border-line bg-surface text-ink shadow-sm', hover: 'hover:bg-subtle' },
  ghost: { base: 'text-muted', hover: 'hover:bg-subtle hover:text-ink' },
  danger: { base: 'bg-danger text-white', hover: 'hover:bg-[#991b1b]' },
  whatsapp: { base: 'bg-whatsapp text-white', hover: 'hover:bg-[#1fbd59]' },
};

// `.btn` 40px · 0 16px · 14px — `.btn-sm` 32px · 0 12px · 13px — `.btn-lg` 48px · 0 20px · 15px.
const SIZE: Record<ButtonSize, { box: string; icon: string }> = {
  sm: { box: 'h-8 px-3 text-[13px]', icon: '[&_svg]:size-3.5' },
  md: { box: 'h-10 px-4 text-[14px]', icon: '[&_svg]:size-4' },
  lg: { box: 'h-12 px-5 text-[15px]', icon: '[&_svg]:size-[18px]' },
};

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon at the inline-start (gap 8px). Sized by the button (14/16/18px); add `icon-dir` to mirror it in RTL. */
  icon?: ReactNode;
  /** Replaces the icon with a spinner, sets `aria-busy` and blocks clicks. The label stays visible. */
  loading?: boolean;
  /** Render the single child (e.g. a `<Link>`) with the button styles (Radix Slot). */
  asChild?: boolean;
  fullWidth?: boolean;
};

/** Host-app button (§9B.2): primary · secondary · ghost · danger · WhatsApp, sm 32 / md 40 / lg 48. */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  asChild = false,
  fullWidth = false,
  disabled = false,
  className,
  children,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  const inert = disabled || loading;
  const iconNode = loading ? <LoaderCircle className="motion-safe:animate-spin" /> : icon;

  return (
    <Comp
      {...(asChild
        ? // A slotted link can't be `disabled`: take it out of the tab order and ignore pointer input instead.
          { 'aria-disabled': inert || undefined, ...(inert && { tabIndex: -1 }) }
        : { type: type ?? 'button', disabled: inert })}
      aria-busy={loading || undefined}
      data-variant={variant}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-btn font-semibold whitespace-nowrap select-none',
        'transition-[background-color,box-shadow,color] duration-150 motion-reduce:transition-none',
        VARIANT[variant].base,
        !inert && VARIANT[variant].hover,
        SIZE[size].box,
        fullWidth && 'w-full',
        disabled && 'cursor-not-allowed opacity-50',
        asChild && inert && 'pointer-events-none',
        loading && 'cursor-progress',
        className,
      )}
      {...props}
    >
      {iconNode != null && iconNode !== false && (
        <span aria-hidden className={cn(iconSlot, SIZE[size].icon)}>
          {iconNode}
        </span>
      )}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  );
}
