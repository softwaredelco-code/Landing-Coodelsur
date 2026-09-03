import { Footer } from "@/presentation/components/layout/Footer";
import { Header } from "@/presentation/components/layout/Header";
import { WhatsAppCTA } from "@/presentation/components/layout/WhatsAppCTA";
import { GoogleAnalytics } from "@/presentation/components/tracking/GoogleAnalytics";
import { TrackingProvider } from "@/presentation/tracking/TrackingProvider";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Coodelsur — Solicitud de crédito",
    template: "%s | Coodelsur",
  },
  description:
    "Solicita tu crédito con Coodelsur. Completa el formulario en línea y contacta a un asesor.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://credito.coodelsursas.com.co"),
  icons: {
    icon: [{ url: "/images/logo.jpg", type: "image/jpeg" }],
    shortcut: "/images/logo.jpg",
    apple: "/images/logo.jpg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={poppins.variable}>
      <body className="font-sans">
        <GoogleAnalytics />
        <Suspense fallback={null}>
          <TrackingProvider>
            <Header />
            <main>{children}</main>
            <Footer />
            <WhatsAppCTA />
          </TrackingProvider>
        </Suspense>
      </body>
    </html>
  );
}
