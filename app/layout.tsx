import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Læseudfordring",
  description: "En læseudfordring der motiverer børn til at læse.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="da" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
