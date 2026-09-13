"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { PRIMARY_NAV, type NavItem } from "@/lib/nav";

/**
 * Header per the approved design mockup, figures 1 to 11.
 *
 * The lockup sits left, the primary navigation right: Collection, Atelier,
 * Trade, Enquire. The current page is marked in italic Cormorant, which is how
 * every mockup distinguishes it.
 *
 * The logo is the supplied wordmark, section 03, as a finished asset. It is a
 * single lockup, so it is never separated or rescaled in parts, and the whole
 * thing is one link. The dark version is used here, on the Ivory ground; the
 * footer carries the light version on Umber. Two assets rather than one
 * recoloured by CSS, which is the substitution the specification rules out.
 *
 * Atelier carries a menu, per the approved design: The Atelier, Bespoke and
 * Materials. It opens on hover, as designed, and also on keyboard focus, so
 * the three pages under it are reachable without a pointer. The label itself
 * stays a link, so clicking Atelier still goes to the atelier page.
 *
 * The Atelier repeats the parent's destination on purpose. On a touch screen
 * the parent row is a toggle that opens the panel rather than a link, so
 * without that first child the atelier page itself would have no way in from
 * the drawer.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  /*
   * The drawer's open group. Hover cannot fire on a touch screen, so on a
   * phone the pages under a parent are revealed by tapping the parent rather
   * than by listing them all the time.
   */
  const [group, setGroup] = useState<string | null>(null);

  /*
   * A parent is current on its own route and on any route beneath it in the
   * menu, so Atelier stays marked while the visitor is reading Materials.
   * Plain startsWith would leave nothing marked there.
   */
  const isCurrent = (item: NavItem) => {
    const matches = (href: string) =>
      href === "/" ? pathname === "/" : pathname.startsWith(href);
    return matches(item.href) || (item.children ?? []).some((c) => matches(c.href));
  };

  return (
    <header className="site-header">
      <Link href="/" className="lockup" aria-label="Collection Noir, home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* 44px tall, section 2. The intrinsic attributes match so the
            browser reserves the right box before the file arrives; the
            height is held in CSS, which is what actually scales it. */}
        <img
          src="/brand/collection-noir-dark.png"
          alt="Collection Noir"
          width={170}
          height={44}
        />
      </Link>

      <nav className="site-nav" aria-label="Primary">
        {PRIMARY_NAV.map((item) =>
          item.children ? (
            <div
              key={item.href}
              className="site-nav__item"
              onMouseEnter={() => setMenu(item.href)}
              onMouseLeave={() => setMenu(null)}
              onFocus={() => setMenu(item.href)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setMenu(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setMenu(null);
                  return;
                }
                /*
                 * Arrow keys move between the trigger and the items beneath
                 * it. The panel is in the markup on every page rather than
                 * mounted on hover, so the links are already focusable and
                 * this only has to move focus along the row.
                 */
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                event.preventDefault();
                setMenu(item.href);
                const links = Array.from(
                  event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"),
                );
                const at = links.indexOf(document.activeElement as HTMLAnchorElement);
                const step = event.key === "ArrowDown" ? 1 : -1;
                const next = links[(at + step + links.length) % links.length];
                next?.focus();
              }}
            >
              <Link
                href={item.href}
                aria-current={isCurrent(item) ? "page" : undefined}
                aria-haspopup="true"
                aria-expanded={menu === item.href}
              >
                {item.label}
              </Link>
              {/*
               * Rendered on every page and hidden with CSS rather than mounted
               * on hover, so the pages under Atelier are in the served markup
               * for a crawler and for a reader who never hovers.
               */}
              <div className="site-nav__menu" data-open={menu === item.href}>
                {item.children.map((child) => (
                  <Link
                    key={child.label}
                    href={child.href}
                    onClick={() => setMenu(null)}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ),
        )}
      </nav>

      {/*
        * Three rules rather than the word Menu. The label is carried by
        * aria-label, so the control still announces itself to a screen
        * reader; the middle rule fades and the outer two cross to make the
        * close mark, so nothing is added to or removed from the markup.
        */}
      <button
        type="button"
        className="site-header__menu"
        aria-expanded={open}
        aria-controls="site-drawer"
        aria-label={open ? "Close menu" : "Open menu"}
        data-open={open}
        onClick={() => setOpen(!open)}
      >
        <span className="site-header__bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {open && (
        <div className="drawer" id="site-drawer">
          <ul className="drawer__list">
            {PRIMARY_NAV.map((item) =>
              item.children ? (
                /*
                 * Atelier. The row opens the pages beneath it rather than
                 * navigating, so Materials is not on show until it is asked
                 * for. The atelier page itself is the first item revealed,
                 * so nothing becomes unreachable by making the row a toggle.
                 */
                <li key={item.href} data-open={group === item.href}>
                  <button
                    type="button"
                    className="drawer__toggle"
                    aria-expanded={group === item.href}
                    aria-controls={`drawer-group-${item.label.toLowerCase()}`}
                    onClick={() =>
                      setGroup(group === item.href ? null : item.href)
                    }
                  >
                    {item.label}
                    <span className="drawer__chevron" aria-hidden="true" />
                  </button>
                  {group === item.href && (
                    <ul
                      className="drawer__sublist"
                      id={`drawer-group-${item.label.toLowerCase()}`}
                    >
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={() => {
                              setOpen(false);
                              setGroup(null);
                            }}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ) : (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </header>
  );
}
