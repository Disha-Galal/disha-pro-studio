import type { NextConfig } from "next";

// تصدير ثابت: التطبيق كامل من جهة العميل (لا API ولا Server Actions)،
// فيصلح للاستضافة المجانية على Vercel / Netlify / Cloudflare Pages / GitHub Pages
// دون أي ارتباط بـ ChatGPT Sites أو Cloudflare Workers.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
