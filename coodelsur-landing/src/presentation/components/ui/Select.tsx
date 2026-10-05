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
      <div id={`${selectId}-container`} className="flex flex-col gap-1.5">
        <label
          htmlFor={selectId}
          className={cn("text-sm font-medium text-coodel-dark", error && "font-semibold text-red-900")}
        >
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-coodel-body transition-colors focus:border-coodel-primary-light focus:outline-none focus:ring-2 focus:ring-coodel-primary-light/20 disabled:bg-gray-50",
            error &&
              "border-2 border-red-500 bg-red-50/25 ring-2 ring-red-200 focus:border-red-600 focus:ring-red-400/30",
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
          <p
            id={`${selectId}-error`}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600"
            role="alert"
          >
            <span>⚠️</span>
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
