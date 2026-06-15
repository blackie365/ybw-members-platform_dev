import * as React from "react";
import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailHighlightBox,
  EmailSubheading,
} from "./email-layout";

interface WelcomeEmailProps {
  firstName: string
  membershipTier: string
}

export function WelcomeEmail({ firstName, membershipTier }: WelcomeEmailProps) {
  return (
    <EmailLayout previewText={`Welcome to the Yorkshire Businesswoman community, ${firstName}!`}>
      <EmailHeading>Welcome to the Community</EmailHeading>
      
      <EmailText>
        Dear {firstName},
      </EmailText>
      
      <EmailText>
        We&apos;re absolutely delighted to welcome you to the Yorkshire Businesswoman community. 
        Your {membershipTier} membership is now active, and you&apos;re part of a thriving network 
        of ambitious women building remarkable businesses across Yorkshire.
      </EmailText>

      <EmailHighlightBox>
        <p
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "18px",
            fontWeight: 500,
            color: "#1c1917",
            margin: "0 0 8px 0",
            fontStyle: "italic",
          }}
        >
          &ldquo;Alone we can do so little; together we can do so much.&rdquo;
        </p>
        <p
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: "13px",
            color: "#78716c",
            margin: 0,
          }}
        >
          — Helen Keller
        </p>
      </EmailHighlightBox>

      <EmailSubheading>Getting Started</EmailSubheading>
      
      <EmailText>
        Here&apos;s what you can do right now:
      </EmailText>

      <table cellPadding="0" cellSpacing="0" width="100%" style={{ marginBottom: "16px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "8px 0", verticalAlign: "top", width: "24px" }}>
              <span style={{ color: "#b5604a", fontWeight: 600 }}>1.</span>
            </td>
            <td style={{ padding: "8px 0" }}>
              <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "15px", color: "#78716c", margin: 0, lineHeight: 1.6 }}>
                <strong style={{ color: "#1c1917" }}>Complete your profile</strong> — Let other members get to know you and your business
              </p>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "8px 0", verticalAlign: "top", width: "24px" }}>
              <span style={{ color: "#b5604a", fontWeight: 600 }}>2.</span>
            </td>
            <td style={{ padding: "8px 0" }}>
              <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "15px", color: "#78716c", margin: 0, lineHeight: 1.6 }}>
                <strong style={{ color: "#1c1917" }}>Explore the resource library</strong> — Access templates, guides, and exclusive content
              </p>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "8px 0", verticalAlign: "top", width: "24px" }}>
              <span style={{ color: "#b5604a", fontWeight: 600 }}>3.</span>
            </td>
            <td style={{ padding: "8px 0" }}>
              <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "15px", color: "#78716c", margin: 0, lineHeight: 1.6 }}>
                <strong style={{ color: "#1c1917" }}>Join the community forum</strong> — Connect, ask questions, and share your expertise
              </p>
            </td>
          </tr>
          {membershipTier === "Premium Member" && (
            <tr>
              <td style={{ padding: "8px 0", verticalAlign: "top", width: "24px" }}>
                <span style={{ color: "#b5604a", fontWeight: 600 }}>4.</span>
              </td>
              <td style={{ padding: "8px 0" }}>
                <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "15px", color: "#78716c", margin: 0, lineHeight: 1.6 }}>
                  <strong style={{ color: "#1c1917" }}>Join the WhatsApp Group</strong> — <a href="https://chat.whatsapp.com/IXzw4rWevCS8gYPYRFhLDd?s=cl&p=i&mlu=2" style={{ color: "#b5604a", textDecoration: "underline" }}>Click here to join</a> our exclusive members-only chat
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <EmailButton href="https://yorkshirebusinesswoman.co.uk/dashboard">
        Access Your Dashboard →
      </EmailButton>

      <EmailText>
        If you have any questions, simply reply to this email — we&apos;re here to help.
      </EmailText>

      <EmailText>
        Best regards,<br />
        <strong style={{ color: "#1c1917" }}>The Yorkshire BusinessWoman Team</strong>
      </EmailText>
    </EmailLayout>
  )
}
