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
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-coodel-dark">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-coodel-body transition-colors placeholder:text-gray-400 focus:border-coodel-primary-light focus:outline-none focus:ring-2 focus:ring-coodel-primary-light/20 disabled:bg-gray-50",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
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
          <p id={`${inputId}-error`} className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
