import * as React from "react"
import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailHighlightBox,
} from "./email-layout"

interface NewsletterWelcomeEmailProps {
  firstName: string
}

export function NewsletterWelcomeEmail({ firstName }: NewsletterWelcomeEmailProps) {
  return (
    <EmailLayout previewText={`You're now subscribed to the Yorkshire Businesswoman Daily Digest!`}>
      <EmailHeading>You're on the list!</EmailHeading>
      
      <EmailText>
        Hi {firstName},
      </EmailText>
      
      <EmailText>
        Thanks for subscribing to the Yorkshire Businesswoman Daily Digest. You'll now receive our latest stories, business insights, and community updates directly in your inbox.
      </EmailText>

      <EmailHighlightBox>
        <p
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: "15px",
            color: "#1c1917",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          We're excited to have you with us! Keep an eye out for our next edition.
        </p>
      </EmailHighlightBox>

      <EmailText>
        In the meantime, you can explore the latest articles and interviews on our website.
      </EmailText>

      <EmailButton href="https://yorkshirebusinesswoman.co.uk/news">
        Read Latest Stories →
      </EmailButton>

      <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "13px", color: "#78716c", marginTop: "32px", lineHeight: 1.6 }}>
        If you didn't mean to subscribe, you can safely ignore this email or unsubscribe at any time using the link in our newsletters.
      </p>
    </EmailLayout>
  )
}
