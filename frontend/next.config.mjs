/** @type {import('next').NextConfig} */
const apiBase = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,

  /*
   * Build output directory.
   *
   * The development server and a production build write incompatible chunk
   * manifests, so sharing one directory between them breaks whichever ran
   * second: the dev server goes looking for a production chunk that dev never
   * emits and fails with "Cannot find module ./638.js".
   *
   * Only development is moved aside. The production build stays on the
   * default `.next`, because that is where a host looks for it: Vercel's
   * Next.js builder resolves the output directory itself and fails the deploy
   * with "The Next.js output directory .next was not found" if the build put
   * it somewhere else. The ternary is written so the safe value is also the
   * fallback, and an unset or unexpected NODE_ENV still builds to `.next`.
   */
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",

  /*
   * The materials library moved under the atelier, where section 9 of the UI
   * specification puts it and where the Atelier menu already implied it was.
   *
   * Permanent rather than temporary, and kept rather than dropped after a
   * release: the old paths were live, the spec sheets and the care guide
   * reference the library, and a 404 on a material is a worse outcome than
   * carrying two redirects indefinitely.
   */
  async redirects() {
    return [
      {
        source: "/materials",
        destination: "/atelier/materials",
        permanent: true,
      },
      {
        source: "/materials/:slug",
        destination: "/atelier/materials/:slug",
        permanent: true,
      },
    ];
  },

  // Image binaries are served by the API. Proxying them through the Next.js
  // origin keeps every asset same-origin, which means no CORS preflight on
  // image requests and no third party host in the cookie policy.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
