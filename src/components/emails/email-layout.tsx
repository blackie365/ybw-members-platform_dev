/* eslint-disable @next/next/no-img-element */
import { ReactNode } from "react"

interface EmailLayoutProps {
  children: ReactNode
  previewText?: string
}

export function EmailLayout({ children, previewText }: EmailLayoutProps) {
  return (
    <div style={{ backgroundColor: "#f8f6f2", padding: "40px 20px", minHeight: "100%" }}>
      {/* Preview text for email clients */}
      {previewText && (
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>
          {previewText}
        </div>
      )}
      
      <table
        cellPadding="0"
        cellSpacing="0"
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          backgroundColor: "#fffefb",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
        width="100%"
      >
        <tbody>
          {/* Header */}
          <tr>
            <td
              style={{
                backgroundColor: "#ffffff",
                padding: "32px 40px",
                textAlign: "center",
              }}
            >
              <img
                src="https://yorkshirebusinesswoman.co.uk/images/logo-nav-v3.png"
                alt="Yorkshire Businesswoman"
                width="200"
                style={{
                  display: "block",
                  margin: "0 auto",
                  maxWidth: "100%",
                  height: "auto"
                }}
              />
            </td>
          </tr>

          {/* Content */}
          <tr>
            <td style={{ padding: "40px" }}>
              {children}
            </td>
          </tr>

          {/* Footer */}
          <tr>
            <td
              style={{
                backgroundColor: "#f8f6f2",
                padding: "32px 40px",
                borderTop: "1px solid #e5e2db",
              }}
            >
              <table cellPadding="0" cellSpacing="0" width="100%">
                <tbody>
                  <tr>
                    <td style={{ textAlign: "center" }}>
                      <p
                        style={{
                          fontFamily: "'Inter', Arial, sans-serif",
                          fontSize: "12px",
                          color: "#78716c",
                          margin: "0 0 16px 0",
                          lineHeight: 1.6,
                        }}
                      >
                        Yorkshire Businesswoman Ltd<br />
                        10 Shetland Drive, Congleton, England, CW12 4FN
                      </p>
                      <p
                        style={{
                          fontFamily: "'Inter', Arial, sans-serif",
                          fontSize: "12px",
                          color: "#78716c",
                          margin: "0 0 16px 0",
                        }}
                      >
                        <a
                          href="https://www.linkedin.com/company/yorkshire-businesswoman"
                          style={{ color: "#78716c", textDecoration: "none" }}
                        >LinkedIn</a>
                        <span style={{ color: "#e7e5e4", margin: "0 8px" }}>&middot;</span>
                        <a
                          href="https://x.com/YorksBizWoman"
                          style={{ color: "#78716c", textDecoration: "none" }}
                        >Twitter</a>
                        <span style={{ color: "#e7e5e4", margin: "0 8px" }}>&middot;</span>
                        <a
                          href="https://www.facebook.com/YorkshireBusinesswoman"
                          style={{ color: "#78716c", textDecoration: "none" }}
                        >Facebook</a>
                        <span style={{ color: "#e7e5e4", margin: "0 8px" }}>&middot;</span>
                        <a
                          href="https://www.instagram.com/yorkshire_businesswoman"
                          style={{ color: "#78716c", textDecoration: "none" }}
                        >Instagram</a>
                      </p>
                      <p
                        style={{
                          fontFamily: "'Inter', Arial, sans-serif",
                          fontSize: "12px",
                          color: "#78716c",
                          margin: 0,
                        }}
                      >
                        <a
                          href="https://yorkshirebusinesswoman.co.uk/unsubscribe"
                          style={{ color: "#b5604a", textDecoration: "none" }}
                        >Unsubscribe</a>
                        {" · "}
                        <a
                          href="https://yorkshirebusinesswoman.co.uk/privacy"
                          style={{ color: "#b5604a", textDecoration: "none" }}
                        >
                          Privacy Policy
                        </a>
                        {" · "}
                        <a
                          href="https://yorkshirebusinesswoman.co.uk/contact"
                          style={{ color: "#b5604a", textDecoration: "none" }}
                        >
                          Contact Us
                        </a>
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Reusable email components
export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: "28px",
        fontWeight: 500,
        color: "#1c1917",
        margin: "0 0 16px 0",
        lineHeight: 1.3,
      }}
    >
      {children}
    </h2>
  )
}

export function EmailSubheading({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: "20px",
        fontWeight: 500,
        color: "#1c1917",
        margin: "24px 0 12px 0",
        lineHeight: 1.3,
      }}
    >
      {children}
    </h3>
  )
}

export function EmailText({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "'Inter', Arial, sans-serif",
        fontSize: "15px",
        color: "#78716c",
        margin: "0 0 16px 0",
        lineHeight: 1.7,
      }}
    >
      {children}
    </p>
  )
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <table cellPadding="0" cellSpacing="0" style={{ margin: "24px 0" }}>
      <tbody>
        <tr>
          <td>
            <a
              href={href}
              style={{
                display: "inline-block",
                backgroundColor: "#b5604a",
                color: "#fffefb",
                fontFamily: "'Inter', Arial, sans-serif",
                fontSize: "14px",
                fontWeight: 500,
                padding: "14px 28px",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function EmailDivider() {
  return (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid #e5e2db",
        margin: "24px 0",
      }}
    />
  )
}

export function EmailHighlightBox({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "#f8f6f2",
        borderLeft: "4px solid #b5604a",
        padding: "20px 24px",
        margin: "24px 0",
        borderRadius: "0 6px 6px 0",
      }}
    >
      {children}
    </div>
  )
}

export function EmailInfoCard({ 
  label, 
  value 
}: { 
  label: string
  value: string 
}) {
  return (
    <div
      style={{
        backgroundColor: "#f8f6f2",
        padding: "16px 20px",
        borderRadius: "6px",
        marginBottom: "12px",
      }}
    >
      <p
        style={{
          fontFamily: "'Inter', Arial, sans-serif",
          fontSize: "12px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#b5604a",
          margin: "0 0 4px 0",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "'Inter', Arial, sans-serif",
          fontSize: "16px",
          fontWeight: 500,
          color: "#1c1917",
          margin: 0,
        }}
      >
        {value}
      </p>
    </div>
  )
}
