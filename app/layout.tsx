import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { copy, LOCALE } from "@/lib/copy";
import "./globals.css";

// Display font — used for headings/branding (maps to --font-display token).
const baloo = Baloo_2({
  variable: "--font-baloo",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

// Body font — default UI text (maps to --font-body token).
const nunito = Nunito({
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: copy.app.name,
  description: copy.app.description,
  appleWebApp: { capable: true, statusBarStyle: "default", title: copy.app.name },
};

export const viewport: Viewport = {
  themeColor: "#F6A623",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang={LOCALE}
      className={`${baloo.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
