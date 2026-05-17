import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailInfoCard,
  EmailDivider,
} from "./email-layout"

interface AccountUpdateEmailProps {
  firstName: string
  updateType: "email" | "password" | "payment" | "profile"
  updateDate: string
  updateTime: string
}

export function AccountUpdateEmail({
  firstName,
  updateType,
  updateDate,
  updateTime,
}: AccountUpdateEmailProps) {
  const updateLabels = {
    email: "Email Address",
    password: "Password",
    payment: "Payment Method",
    profile: "Profile Information",
  }

  const updateDescriptions = {
    email: "Your email address has been successfully updated. Future communications will be sent to your new email address.",
    password: "Your password has been successfully changed. You can now use your new password to sign in.",
    payment: "Your payment method has been successfully updated. Your next billing will use the new payment details.",
    profile: "Your profile information has been successfully updated. Other members can now see your changes.",
  }

  return (
    <EmailLayout previewText={`Your ${updateLabels[updateType].toLowerCase()} has been updated`}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          style={{
            display: "inline-block",
            width: "64px",
            height: "64px",
            backgroundColor: "rgba(181, 96, 74, 0.1)",
            borderRadius: "50%",
            lineHeight: "64px",
            fontSize: "28px",
          }}
        >
          ✓
        </div>
      </div>

      <EmailHeading>Account Updated</EmailHeading>
      
      <EmailText>
        Hello {firstName},
      </EmailText>
      
      <EmailText>
        {updateDescriptions[updateType]}
      </EmailText>

      <EmailInfoCard label="What Changed" value={updateLabels[updateType]} />
      <EmailInfoCard label="Date" value={updateDate} />
      <EmailInfoCard label="Time" value={updateTime} />

      <EmailDivider />

      <div
        style={{
          backgroundColor: "#fef2f2",
          borderLeft: "4px solid #dc2626",
          padding: "16px 20px",
          margin: "24px 0",
          borderRadius: "0 6px 6px 0",
        }}
      >
        <p
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: "14px",
            color: "#7f1d1d",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          <strong>Didn&apos;t make this change?</strong>
          {" "}If you didn&apos;t authorise this update, please secure your account immediately 
          by resetting your password and contacting our support team.
        </p>
      </div>

      <EmailButton href="https://yorkshirebusinesswoman.com/security">
        Review Account Security →
      </EmailButton>

      <EmailText>
        If you made this change, no further action is needed. Your account is secure.
      </EmailText>

      <EmailText>
        Best regards,<br />
        <strong style={{ color: "#1c1917" }}>The Yorkshire Businesswoman Team</strong>
      </EmailText>
    </EmailLayout>
  )
}
