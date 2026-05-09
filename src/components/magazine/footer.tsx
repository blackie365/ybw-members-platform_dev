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
    { name: "Cookie Policy", href: "/privacy" },
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
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        {/* Main footer content */}
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Brand section */}
          <div className="lg:max-w-md">
            <Link href="/" className="inline-flex flex-col h-10 sm:h-12 relative">
              <img
                src="https://yorkshirebusinesswoman.co.uk/content/images/2026/03/Asset-9@3x-2.png"
                alt="Yorkshire Businesswoman"
                className="h-full w-auto object-contain"
              />
            </Link>
            <p className="mt-6 leading-relaxed text-primary-foreground/70">
              Empowering ambitious women with the insights, strategies, and 
              inspiration needed to lead with confidence and build lasting success.
            </p>
            <div className="mt-6 flex gap-4">
              {socialLinks.map((social) => (
                <Link
                  key={social.name}
                  href={social.href}
                  className="flex h-10 w-10 items-center justify-center border border-primary-foreground/20 transition-colors hover:border-accent hover:bg-accent"
                  aria-label={social.name}
                >
                  <social.icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>

          {/* Links grid */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider">
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
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider">
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
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider">
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
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider">
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
          <p className="text-xs text-primary-foreground/50">
            © 2026 Yorkshire Businesswoman. All rights reserved.
          </p>
          <p className="text-xs text-primary-foreground/50">
            Designed for leaders. Built for impact.
          </p>
        </div>
      </div>
    </footer>
  )
}
