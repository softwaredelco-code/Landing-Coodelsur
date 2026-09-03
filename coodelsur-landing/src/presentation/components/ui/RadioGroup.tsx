"use client";

import { cn } from "@/shared/utils";
import { forwardRef } from "react";

interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  label: string;
  name: string;
  options: RadioOption[];
  value?: string;
  error?: string;
  required?: boolean;
  className?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

export const RadioGroup = forwardRef<HTMLInputElement, RadioGroupProps>(
  ({ label, name, options, value = "", error, required, className, onChange, onBlur }, ref) => {
    return (
      <fieldset className={cn("flex flex-col gap-2", className)}>
        <legend className="text-sm font-medium text-coodel-dark">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </legend>
        <div className="flex flex-wrap gap-3">
          {options.map((opt, index) => {
            const checked = value === opt.value;
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex min-h-[44px] min-w-[96px] cursor-pointer items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm transition-colors",
                  checked
                    ? "border-coodel-accent bg-coodel-accent/5 text-coodel-accent"
                    : "border-gray-300 text-coodel-body",
                )}
              >
                <input
                  ref={index === 0 ? ref : undefined}
                  type="radio"
                  name={name}
                  value={opt.value}
                  checked={checked}
                  onChange={onChange}
                  onBlur={onBlur}
                  className="h-4 w-4 accent-coodel-accent"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </fieldset>
    );
  },
);

RadioGroup.displayName = "RadioGroup";
