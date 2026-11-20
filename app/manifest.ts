import type { MetadataRoute } from "next";

/** يجعل المكتب الافتراضي قابلاً للتثبيت كتطبيق على الجوال والآيباد والكمبيوتر */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "المكتب الافتراضي",
    short_name: "المكتب",
    description: "فريق وكلاء إدارة الاتصال والتسويق",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f6fa",
    theme_color: "#1f3b5c",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
