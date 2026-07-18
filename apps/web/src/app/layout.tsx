import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ReviewTrace",
  description: "将 App Store 评论转化为有证据链支撑的产品计划。",
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
