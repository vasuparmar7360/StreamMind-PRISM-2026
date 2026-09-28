import { Children } from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* Indigo primary */
        default:
          'bg-brand-primary text-primary-foreground shadow-none hover:bg-brand-primary-hover hover:shadow-none active:scale-[0.98]',
        outline:
          'border-border bg-surface text-text-secondary hover:bg-surface-elevated hover:border-brand-primary/30 hover:text-text-primary active:scale-[0.98]',
        secondary:
          'bg-surface-elevated text-text-secondary hover:bg-background-secondary hover:text-text-primary active:scale-[0.98]',
        ghost:
          'text-text-muted hover:bg-brand-primary/08 hover:text-text-primary active:scale-[0.98]',
        /* Danger / destructive — red */
        destructive:
          'bg-danger/10 text-danger border border-danger/15 hover:bg-danger/18 hover:border-danger/30 focus-visible:border-danger/40 focus-visible:ring-danger/20 active:scale-[0.98]',
        warning: 'border-warning/25 bg-warning/10 text-warning hover:bg-warning/20 active:scale-[0.98]',
        link: 'text-brand-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        icon: 'size-8',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const lightBulb = variant !== 'ghost' && variant !== 'link'
  const hasIndicator = lightBulb && !size?.startsWith('icon')

  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-light-bulb={lightBulb ? '' : undefined}
      data-light-indicator={hasIndicator ? '' : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {hasIndicator && typeof children !== 'function'
        ? Children.map(children, (child) =>
            typeof child === 'string' && child.trim() ? (
              <span className="light-bulb-label">
                <span className="light-bulb-label-track">
                  <span>{child}</span>
                  <span aria-hidden="true">{child}</span>
                </span>
              </span>
            ) : child,
          )
        : children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
