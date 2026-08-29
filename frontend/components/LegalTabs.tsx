"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LEGAL_TABS } from "@/lib/nav";

export function LegalTabs() {
  const pathname = usePathname();

  return (
    <nav className="tabs" aria-label="Legal">
      {LEGAL_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
