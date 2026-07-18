import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ReviewTrace",
  description: "Trace App Store reviews into grounded product plans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
