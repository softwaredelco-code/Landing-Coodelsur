export default function AdminLeadDetailLoading() {
  return (
    <div className="min-h-screen bg-coodel-surface">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 md:px-6">
          <div className="mb-2 h-3 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-3 w-64 animate-pulse rounded bg-gray-100" />
        </div>
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-6 md:px-6">
        <section className="border border-gray-200 bg-white p-5">
          <div className="mb-4 h-5 w-40 animate-pulse rounded bg-gray-200" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </section>

        <section className="border border-gray-200 bg-white p-5">
          <div className="mb-4 h-5 w-28 animate-pulse rounded bg-gray-200" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded border border-gray-100 bg-gray-50" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
