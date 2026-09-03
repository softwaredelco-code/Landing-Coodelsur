"use client";

import { cn, formatCOPInput, parseCOPInput } from "@/shared/utils";
import { InputHTMLAttributes, forwardRef, useEffect, useState } from "react";

interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "defaultValue"> {
  label: string;
  error?: string;
  helperText?: string;
  value?: number | string | null;
  onValueChange?: (value: number) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, label, error, helperText, id, value, onValueChange, onBlur, name, ...props }, ref) => {
    const inputId = id ?? name;
    const [display, setDisplay] = useState(() => formatCOPInput(value));

    useEffect(() => {
      setDisplay(formatCOPInput(value));
    }, [value]);

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-coodel-dark">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <input
          ref={ref}
          id={inputId}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          placeholder="$ 0"
          onChange={(event) => {
            const next = parseCOPInput(event.target.value);
            setDisplay(formatCOPInput(next || ""));
            onValueChange?.(next);
          }}
          onBlur={(event) => {
            setDisplay(formatCOPInput(parseCOPInput(event.target.value) || value || ""));
            onBlur?.(event);
          }}
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

CurrencyInput.displayName = "CurrencyInput";
