import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "src/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-md border bg-transparent text-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-input shadow-sm focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring",
        filled:
          "border-transparent bg-base02/50 focus-visible:bg-base02/70 focus-visible:ring-2 focus-visible:ring-ring/20",
        ghost:
          "border-transparent hover:bg-base02/30 focus-visible:bg-base02/50 focus-visible:ring-0",
        underline:
          "rounded-none border-0 border-b-2 border-base03 px-0 focus-visible:border-primary focus-visible:ring-0",
      },
      inputSize: {
        sm: "h-8 px-2.5 text-xs",
        default: "h-9 px-3 py-1",
        lg: "h-11 px-4 text-base",
      },
      state: {
        default: "",
        error:
          "border-destructive/50 text-destructive placeholder:text-destructive/50 focus-visible:ring-destructive/20 focus-visible:border-destructive",
        success:
          "border-success/50 focus-visible:ring-success/20 focus-visible:border-success",
        warning:
          "border-warning/50 focus-visible:ring-warning/20 focus-visible:border-warning",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
      state: "default",
    },
  },
);

export interface InputProps
  extends
    Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      variant,
      inputSize,
      state,
      leftIcon,
      rightIcon,
      leftAddon,
      rightAddon,
      ...props
    },
    ref,
  ) => {
    if (leftIcon || rightIcon || leftAddon || rightAddon) {
      return (
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="flex h-full items-center rounded-l-md border border-r-0 border-input bg-base02/50 px-3 text-sm text-muted-foreground">
              {leftAddon}
            </div>
          )}
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 flex items-center text-muted-foreground [&>svg]:size-4">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              inputVariants({ variant, inputSize, state }),
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              leftAddon && "rounded-l-none",
              rightAddon && "rounded-r-none",
              className,
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="pointer-events-none absolute right-3 flex items-center text-muted-foreground [&>svg]:size-4">
              {rightIcon}
            </div>
          )}
          {rightAddon && (
            <div className="flex h-full items-center rounded-r-md border border-l-0 border-input bg-base02/50 px-3 text-sm text-muted-foreground">
              {rightAddon}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize, state }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
