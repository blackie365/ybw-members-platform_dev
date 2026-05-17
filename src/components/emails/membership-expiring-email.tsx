import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailHighlightBox,
  EmailInfoCard,
  EmailDivider,
} from "./email-layout"

interface MembershipExpiringEmailProps {
  firstName: string
  membershipTier: string
  expiryDate: string
  renewalAmount: string
}

export function MembershipExpiringEmail({
  firstName,
  membershipTier,
  expiryDate,
  renewalAmount,
}: MembershipExpiringEmailProps) {
  return (
    <EmailLayout previewText={`Your ${membershipTier} membership expires on ${expiryDate}`}>
      <EmailHeading>We&apos;ll Miss You</EmailHeading>
      
      <EmailText>
        Dear {firstName},
      </EmailText>
      
      <EmailText>
        We noticed your Yorkshire Businesswoman membership is coming to an end. 
        Before it expires, we wanted to reach out personally — we&apos;d hate to see you go.
      </EmailText>

      <EmailInfoCard label="Membership" value={membershipTier} />
      <EmailInfoCard label="Expires On" value={expiryDate} />

      <EmailHighlightBox>
        <p
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: "14px",
            color: "#78716c",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "#1c1917" }}>What you&apos;ll lose access to:</strong>
        </p>
        <ul
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: "14px",
            color: "#78716c",
            margin: "12px 0 0 0",
            paddingLeft: "20px",
            lineHeight: 1.8,
          }}
        >
          <li>Exclusive resource library with templates and guides</li>
          <li>Private community forum and networking</li>
          <li>Member-only events and workshops</li>
          <li>Monthly masterclasses and Q&A sessions</li>
        </ul>
      </EmailHighlightBox>

      <EmailText>
        Renew today for just <strong style={{ color: "#1c1917" }}>£{renewalAmount}</strong> and 
        continue your journey with hundreds of like-minded businesswomen across Yorkshire.
      </EmailText>

      <EmailButton href="https://yorkshirebusinesswoman.com/renew">
        Renew Membership →
      </EmailButton>

      <EmailDivider />

      <EmailText>
        If there&apos;s anything we can do to improve your experience or if you have feedback 
        to share, we&apos;d genuinely love to hear from you. Simply reply to this email.
      </EmailText>

      <EmailText>
        Whatever you decide, thank you for being part of our community.<br />
        <strong style={{ color: "#1c1917" }}>The Yorkshire Businesswoman Team</strong>
      </EmailText>
    </EmailLayout>
  )
}
