import type { AdminLeadField } from "@/application/lead/admin-lead-sections";

export function LeadInfoGrid({ fields }: { fields: AdminLeadField[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {field.label}
          </dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-coodel-dark">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LeadSummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p
        className={
          highlight
            ? "mt-1 text-lg font-bold text-coodel-primary"
            : "mt-1 text-sm font-semibold text-coodel-dark"
        }
      >
        {value}
      </p>
    </div>
  );
}
