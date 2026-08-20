"use client";

import { FileUpload } from "@/components/forms/FileUpload";
import { GeolocationCapture } from "@/components/forms/GeolocationCapture";
import { Input } from "@/components/ui/Input";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import type { FileCapture, FormFieldConfig, GeoCoords } from "@/types/credito";
import type { FieldError, UseFormRegister, UseFormSetValue } from "react-hook-form";
import dynamic from "next/dynamic";

const SignaturePad = dynamic(() => import("./SignaturePad").then((m) => m.SignaturePad), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-lg bg-gray-100" />,
});

interface FormFieldProps {
  field: FormFieldConfig;
  register: UseFormRegister<Record<string, unknown>>;
  setValue: UseFormSetValue<Record<string, unknown>>;
  error?: FieldError;
  value?: unknown;
}

export function FormField({ field, register, setValue, error, value }: FormFieldProps) {
  if (field.type === "hidden") {
    return <input type="hidden" {...register(field.name)} />;
  }

  if (field.type === "select") {
    return (
      <Select
        label={field.label}
        options={field.options ?? []}
        placeholder="Seleccionar..."
        required={field.required}
        error={error?.message}
        {...register(field.name)}
      />
    );
  }

  if (field.type === "radio") {
    const registered = register(field.name);
    return (
      <RadioGroup
        label={field.label}
        name={field.name}
        options={field.options ?? []}
        required={field.required}
        error={error?.message}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => {
          registered.onChange(event);
          setValue(field.name, event.target.value, { shouldValidate: true });
        }}
        onBlur={registered.onBlur}
        ref={registered.ref}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={field.name} className="text-sm font-medium text-coodel-dark">
          {field.label}
          {field.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <textarea
          id={field.name}
          rows={3}
          placeholder={field.placeholder}
          className="rounded-lg border border-gray-300 px-4 py-2.5 focus:border-coodel-primary-light focus:outline-none focus:ring-2 focus:ring-coodel-primary-light/20"
          {...register(field.name)}
        />
        {error && <p className="text-xs text-red-600">{error.message}</p>}
      </div>
    );
  }

  if (field.type === "file" || field.type === "video") {
    return (
      <FileUpload
        id={field.name}
        label={field.label}
        accept={field.accept ?? (field.type === "video" ? "video/*" : "image/*")}
        capture={field.type === "video" ? "user" : "environment"}
        kind={field.type === "video" ? "video" : "image"}
        required={field.required}
        helperText={field.helperText}
        value={value as FileCapture | undefined}
        onChange={(file) => setValue(field.name, file, { shouldValidate: true })}
        error={error?.message}
      />
    );
  }

  if (field.type === "signature") {
    return (
      <SignaturePad
        value={typeof value === "string" ? value : ""}
        onChange={(dataUrl) => setValue(field.name, dataUrl, { shouldValidate: true })}
        error={error?.message}
      />
    );
  }

  if (field.type === "geolocation") {
    return (
      <GeolocationCapture
        value={value as GeoCoords | undefined}
        onChange={(coords) => setValue(field.name, coords, { shouldValidate: true })}
        error={error?.message}
      />
    );
  }

  return (
    <Input
      label={field.label}
      type={field.type}
      placeholder={field.placeholder}
      readOnly={field.readOnly}
      required={field.required}
      error={error?.message}
      helperText={field.helperText}
      {...register(field.name)}
    />
  );
}
