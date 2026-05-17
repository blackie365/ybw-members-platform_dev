import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailHighlightBox,
  EmailInfoCard,
} from "./email-layout"

interface RenewalReminderEmailProps {
  firstName: string
  membershipTier: string
  renewalDate: string
  amount: string
  daysRemaining: number
}

export function RenewalReminderEmail({
  firstName,
  membershipTier,
  renewalDate,
  amount,
  daysRemaining,
}: RenewalReminderEmailProps) {
  return (
    <EmailLayout previewText={`Your ${membershipTier} membership renews in ${daysRemaining} days`}>
      <EmailHeading>Membership Renewal Reminder</EmailHeading>
      
      <EmailText>
        Dear {firstName},
      </EmailText>
      
      <EmailText>
        This is a friendly reminder that your Yorkshire Businesswoman membership will 
        automatically renew in <strong style={{ color: "#1c1917" }}>{daysRemaining} days</strong>. 
        We wanted to give you advance notice so there are no surprises.
      </EmailText>

      <EmailInfoCard label="Membership Tier" value={membershipTier} />
      <EmailInfoCard label="Renewal Date" value={renewalDate} />
      <EmailInfoCard label="Renewal Amount" value={`£${amount}`} />

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
          <strong style={{ color: "#1c1917" }}>No action required.</strong>
          {" "}Your membership will renew automatically using your saved payment method. 
          If you need to update your payment details, please do so before the renewal date.
        </p>
      </EmailHighlightBox>

      <EmailText>
        As a member, you&apos;ve unlocked exclusive benefits including our resource library, 
        networking events, and the private community forum. We&apos;re so glad to have you with us.
      </EmailText>

      <table cellPadding="0" cellSpacing="0" width="100%" style={{ margin: "24px 0" }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: "8px" }}>
              <a
                href="https://yorkshirebusinesswoman.com/billing"
                style={{
                  display: "inline-block",
                  backgroundColor: "#b5604a",
                  color: "#fffefb",
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: "14px",
                  fontWeight: 500,
                  padding: "14px 24px",
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
              >
                Update Payment →
              </a>
            </td>
            <td>
              <a
                href="https://yorkshirebusinesswoman.com/membership"
                style={{
                  display: "inline-block",
                  backgroundColor: "#fffefb",
                  color: "#1c1917",
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: "14px",
                  fontWeight: 500,
                  padding: "14px 24px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  border: "1px solid #e5e2db",
                }}
              >
                View Benefits
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <EmailText>
        If you have any questions or wish to make changes to your membership, 
        please contact us before the renewal date.
      </EmailText>

      <EmailText>
        Warm regards,<br />
        <strong style={{ color: "#1c1917" }}>The Yorkshire Businesswoman Team</strong>
      </EmailText>
    </EmailLayout>
  )
}
