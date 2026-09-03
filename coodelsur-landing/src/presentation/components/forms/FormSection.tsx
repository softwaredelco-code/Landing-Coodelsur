"use client";

interface FormSectionProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  stepNumber?: number;
  totalSteps?: number;
}

export function FormSection({
  id,
  title,
  description,
  children,
  stepNumber,
  totalSteps,
}: FormSectionProps) {
  return (
    <section id={id} className="overflow-hidden border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-100 bg-gradient-to-r from-coodel-primary/[0.04] to-transparent px-5 py-4">
        {stepNumber && totalSteps && (
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-coodel-accent">
            Paso {stepNumber} de {totalSteps}
          </span>
        )}
        <h2 className="text-lg font-semibold text-coodel-dark">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
