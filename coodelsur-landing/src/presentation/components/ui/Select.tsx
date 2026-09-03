import { cn } from "@/shared/utils";
import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { label: string; value: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id ?? props.name;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-coodel-dark">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-coodel-body transition-colors focus:border-coodel-primary-light focus:outline-none focus:ring-2 focus:ring-coodel-primary-light/20 disabled:bg-gray-50",
            error && "border-red-500",
            className,
          )}
          aria-invalid={error ? "true" : "false"}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
