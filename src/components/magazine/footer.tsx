import Link from "next/link"
import { Instagram, Linkedin, Twitter } from "lucide-react"

const footerLinks = {
  magazine: [
    { name: "About Us", href: "/about" },
    { name: "Our Team", href: "/about" },
    { name: "Members Directory", href: "/members" },
    { name: "Contact", href: "/contact" },
  ],
  categories: [
    { name: "Leadership", href: "/news?tag=leadership" },
    { name: "Finance", href: "/news?tag=finance" },
    { name: "News", href: "/news" },
    { name: "Lifestyle", href: "/news?tag=lifestyle" },
  ],
  resources: [
    { name: "Events", href: "/news?tag=events" },
    { name: "Member Dashboard", href: "/dashboard" },
    { name: "Join Us", href: "/membership" },
    { name: "Login", href: "/login" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Cookie Policy", href: "/cookies" },
  ],
}

const socialLinks = [
  { name: "Instagram", icon: Instagram, href: "https://www.instagram.com/yorkshirebusinesswoman" },
  { name: "LinkedIn", icon: Linkedin, href: "https://www.linkedin.com/company/yorkshire-businesswoman" },
  { name: "Twitter", icon: Twitter, href: "https://twitter.com/yorkshirebusinesswoman" },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        {/* Main footer content */}
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand section */}
          <div className="lg:col-span-4">
            <Link href="/" className="inline-block">
              <img
                src="/images/logo-footer-v2.png"
                alt="Yorkshire Businesswoman"
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </Link>
            <p className="mt-6 text-[15px] leading-relaxed text-primary-foreground/70 max-w-sm">
              Empowering ambitious women with the insights, strategies, and 
              inspiration needed to lead with confidence and build lasting success.
            </p>
            <div className="mt-8 flex gap-3">
              {socialLinks.map((social) => (
                <Link
                  key={social.name}
                  href={social.href}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-foreground/20 transition-all hover:border-accent hover:bg-accent hover:text-accent-foreground"
                  aria-label={social.name}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <social.icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>

          {/* Links grid */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            <div>
              <h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50">
                Magazine
              </h3>
              <ul className="space-y-3">
                {footerLinks.magazine.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-primary-foreground/70 transition-colors hover:text-accent"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50">
                Categories
              </h3>
              <ul className="space-y-3">
                {footerLinks.categories.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-primary-foreground/70 transition-colors hover:text-accent"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50">
                Resources
              </h3>
              <ul className="space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-primary-foreground/70 transition-colors hover:text-accent"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50">
                Legal
              </h3>
              <ul className="space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-primary-foreground/70 transition-colors hover:text-accent"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 pt-8 sm:flex-row">
          <p className="text-xs text-primary-foreground/40">
            © {new Date().getFullYear()} Yorkshire Businesswoman. All rights reserved.
          </p>
          <p className="text-xs text-primary-foreground/40">
            Designed for leaders. Built for impact.
          </p>
        </div>
      </div>
    </footer>
  )
}
