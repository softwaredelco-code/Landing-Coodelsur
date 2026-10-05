import { cn } from "@/shared/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <div id={`${inputId}-container`} className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className={cn("text-sm font-medium text-coodel-dark", error && "font-semibold text-red-900")}
        >
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-coodel-body transition-colors placeholder:text-gray-400 focus:border-coodel-primary-light focus:outline-none focus:ring-2 focus:ring-coodel-primary-light/20 disabled:bg-gray-50",
            error &&
              "border-2 border-red-500 bg-red-50/25 ring-2 ring-red-200 focus:border-red-600 focus:ring-red-400/30",
            className,
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-xs text-gray-500">
            {helperText}
          </p>
        )}
        {error && (
          <p
            id={`${inputId}-error`}
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

Input.displayName = "Input";
