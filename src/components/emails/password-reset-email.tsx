import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailHighlightBox,
} from "./email-layout"

export function PasswordResetEmail({ firstName, resetLink }: { firstName: string, resetLink: string }) {
  return (
    <EmailLayout previewText="Reset your Yorkshire Businesswoman password">
      <EmailHeading>Reset Your Password</EmailHeading>
      
      <EmailText>
        Hello {firstName},
      </EmailText>
      
      <EmailText>
        We received a request to reset the password for your Yorkshire Businesswoman account.
      </EmailText>

      <EmailText>
        Please click the button below to create a new, secure password.
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
          <strong style={{ color: "#1c1917" }}>This link expires in 1 hour.</strong>
          {" "}If you didn&apos;t request a password reset, you can safely ignore this email — your account remains secure.
        </p>
      </EmailHighlightBox>

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
