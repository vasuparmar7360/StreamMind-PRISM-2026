import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-brand-primary text-primary-foreground [a]:hover:bg-brand-primary-hover",
        secondary:
          "bg-surface-elevated text-text-secondary [a]:hover:bg-background-secondary",
        destructive:
          "bg-danger/10 text-danger focus-visible:ring-danger/20 dark:bg-danger/15 dark:focus-visible:ring-danger/30 [a]:hover:bg-danger/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-brand-primary underline-offset-4 hover:underline",
        /* Current and approved states use success. */
        current:
          "border-success/20 bg-success/10 text-[10px] font-semibold tracking-wider text-success",
        /* REPLACED — muted */
        replaced:
          "border-border bg-surface-elevated/80 text-[9px] font-medium text-muted-foreground",
        /* Conflicts need review; destructive actions remain red. */
        conflict:
          "border-warning/20 bg-warning/10 text-[10px] font-semibold tracking-wider text-warning",
        /* PENDING — gold */
        pending:
          "border-brand-secondary/20 bg-brand-secondary/10 text-[10px] font-semibold tracking-wider text-brand-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
