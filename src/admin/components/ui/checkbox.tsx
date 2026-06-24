import * as React from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "../../lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, indeterminate = false, disabled, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate && !checked;
      }
    }, [indeterminate, checked]);

    const visualChecked = Boolean(checked) || indeterminate;
    const visualState = indeterminate ? "indeterminate" : visualChecked ? "checked" : "unchecked";

    return (
      <label
        className={cn(
          "group relative inline-flex h-4 w-4 flex-none cursor-pointer select-none items-center justify-center rounded-[5px] border transition",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
          disabled && "cursor-not-allowed opacity-50",
          visualState === "unchecked" && "border-border bg-card hover:border-foreground/40",
          visualState === "checked" && "border-primary bg-primary text-primary-foreground",
          visualState === "indeterminate" && "border-primary bg-primary text-primary-foreground",
          className,
        )}
      >
        <input
          ref={inputRef}
          type="checkbox"
          checked={Boolean(checked)}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
        {visualState === "checked" ? (
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
        ) : null}
        {visualState === "indeterminate" ? (
          <Minus className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
        ) : null}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
