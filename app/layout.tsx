import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MusesSystem",
  description: "AI 创作平台：用激情与目标设计未来，释放你的创造潜能",
  icons: {
    icon: "/bs_logo.jpeg",
  },
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
