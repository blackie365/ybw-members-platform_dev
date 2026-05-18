import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailHighlightBox,
} from "./email-layout"

export function PasswordResetEmail({ firstName, resetLink }: { firstName: string, resetLink: string }) {
  return (
    <EmailLayout previewText="Secure your Yorkshire Businesswoman account">
      <EmailHeading>Action Required: Reset Your Password</EmailHeading>
      
      <EmailText>
        Hello {firstName},
      </EmailText>
      
      <EmailText>
        As part of our recent platform updates, we require all members to reset their passwords to ensure the continued security of their accounts.
      </EmailText>

      <EmailText>
        Please click the button below to visit our secure password reset form. Once there, enter your email address and we will send you a fresh, one-time reset link.
      </EmailText>

      <EmailButton href={resetLink}>
        Go to Reset Form →
      </EmailButton>

      <EmailText>
        For your security, once you receive the fresh link in your inbox, it will be valid for 1 hour.
      </EmailText>

      <EmailText>
        If you have any questions or need assistance, please don't hesitate to contact our support team.
      </EmailText>

      <EmailText>
        Best regards,<br />
        <strong style={{ color: "#1c1917" }}>The Yorkshire Businesswoman Team</strong>
      </EmailText>
    </EmailLayout>
  )
}
