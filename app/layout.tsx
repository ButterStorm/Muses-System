import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuperFlow - AI Creation Platform",
  description: "Design Your Future with Passion & Purpose",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
