import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The administration area is never indexed.
      disallow: ["/admin", "/admin/"],
    },
    sitemap: "https://collectionnoir.com/sitemap.xml",
  };
}
