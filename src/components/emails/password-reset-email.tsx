import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailHighlightBox,
} from "./email-layout"

interface PasswordResetEmailProps {
  firstName: string
  resetLink: string
  expiryHours: number
}

export function PasswordResetEmail({ firstName, resetLink, expiryHours }: PasswordResetEmailProps) {
  return (
    <EmailLayout previewText="Reset your Yorkshire Businesswoman password">
      <EmailHeading>Reset Your Password</EmailHeading>
      
      <EmailText>
        Hello {firstName},
      </EmailText>
      
      <EmailText>
        We received a request to reset the password for your Yorkshire Businesswoman account. 
        Click the button below to create a new password.
      </EmailText>

      <EmailButton href={resetLink}>
        Reset Password →
      </EmailButton>

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
          <strong style={{ color: "#1c1917" }}>This link expires in {expiryHours} hours.</strong>
          {" "}If you didn&apos;t request a password reset, you can safely ignore this email — your account remains secure.
        </p>
      </EmailHighlightBox>

      <EmailText>
        For security reasons, this link can only be used once. If you need another reset link, 
        please visit our website and request a new one.
      </EmailText>

      <EmailText>
        Stay safe,<br />
        <strong style={{ color: "#1c1917" }}>The Yorkshire Businesswoman Team</strong>
      </EmailText>
    </EmailLayout>
  )
}
