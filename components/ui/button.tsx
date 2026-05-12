import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium outline-none transition duration-150 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border border-primary/20 bg-primary text-white shadow-sm shadow-primary/20 hover:-translate-y-0.5 hover:text-white hover:shadow-md hover:shadow-primary/20",
        destructive:
          "border border-destructive/20 bg-destructive text-destructive-foreground shadow-sm hover:-translate-y-0.5 hover:opacity-95 focus-visible:ring-destructive/20",
        outline:
          "border border-border/80 bg-[color:var(--surface-1)] text-foreground shadow-sm hover:-translate-y-0.5 hover:bg-accent/65 hover:text-accent-foreground",
        secondary:
          "border border-border bg-[color:var(--surface-3)] text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/90",
        ghost:
          "bg-transparent text-foreground/80 hover:bg-accent/60 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-sm has-[>svg]:px-3",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 px-6 text-sm has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  style,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const primaryInvariantStyle =
    variant === "default"
      ? {
          ...style,
          backgroundColor: "var(--primary)",
          borderColor: "color-mix(in oklch, var(--primary) 20%, transparent)",
          color: "#fff",
        }
      : style

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      style={primaryInvariantStyle}
      {...props}
    />
  )
}

export { Button, buttonVariants }
