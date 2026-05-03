import Link from "next/link"
import { Instagram, Linkedin, Twitter } from "lucide-react"

const footerLinks = {
  magazine: [
    { name: "About Us", href: "#" },
    { name: "Our Team", href: "#" },
    { name: "Careers", href: "#" },
    { name: "Contact", href: "#" },
  ],
  categories: [
    { name: "Leadership", href: "#" },
    { name: "Finance", href: "#" },
    { name: "Innovation", href: "#" },
    { name: "Lifestyle", href: "#" },
  ],
  resources: [
    { name: "Events", href: "#" },
    { name: "Podcast", href: "#" },
    { name: "Newsletter", href: "#" },
    { name: "Awards", href: "#" },
  ],
  legal: [
    { name: "Privacy Policy", href: "#" },
    { name: "Terms of Service", href: "#" },
    { name: "Cookie Policy", href: "#" },
  ],
}

const socialLinks = [
  { name: "Instagram", icon: Instagram, href: "#" },
  { name: "LinkedIn", icon: Linkedin, href: "#" },
  { name: "Twitter", icon: Twitter, href: "#" },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        {/* Main footer content */}
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Brand section */}
          <div className="lg:max-w-md">
            <Link href="/" className="flex flex-col">
              <span className="font-serif text-2xl font-semibold tracking-tight">
                ELÉVATE
              </span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-primary-foreground/60">
                Business & Beyond
              </span>
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
            © 2026 ELÉVATE Magazine. All rights reserved.
          </p>
          <p className="text-xs text-primary-foreground/50">
            Designed for leaders. Built for impact.
          </p>
        </div>
      </div>
    </footer>
  )
}
