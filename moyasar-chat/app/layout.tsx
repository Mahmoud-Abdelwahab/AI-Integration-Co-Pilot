import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moyasar AI Co-Pilot",
  description: "Your intelligent assistant for Moyasar SDK integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}