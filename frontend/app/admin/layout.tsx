import type { Metadata } from "next";

import "@/styles/admin.css";

export const metadata: Metadata = {
  title: "Administration",
  // The console is never indexed.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
