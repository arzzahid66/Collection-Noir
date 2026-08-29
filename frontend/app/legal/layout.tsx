import type { Metadata } from "next";

import { LegalTabs } from "@/components/LegalTabs";

export const metadata: Metadata = {
  title: { default: "Legal", template: "%s · Collection Noir" },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="page section">
      <p className="eyebrow">Legal</p>
      <LegalTabs />
      {children}
    </section>
  );
}
