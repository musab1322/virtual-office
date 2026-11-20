import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "المكتب الافتراضي",
  description: "فريق وكلاء ذكاء اصطناعي مرتبط بـ Microsoft Teams",
  appleWebApp: { capable: true, title: "المكتب", statusBarStyle: "default" },
};

// مقاس الشاشة الفعلي على الجوال والآيباد، مع دعم حواف الشاشات الحديثة
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f3b5c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
