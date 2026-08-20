import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mb-2 text-4xl font-bold text-coodel-dark">404</h1>
      <p className="mb-6 text-coodel-body">La página que buscas no existe.</p>
      <Link
        href="/"
        className="rounded-pill bg-coodel-accent px-6 py-3 font-semibold text-white hover:bg-coodel-accent-light"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
