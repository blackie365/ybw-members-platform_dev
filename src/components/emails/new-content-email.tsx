import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailDivider,
} from "./email-layout";

interface NewContentEmailProps {
  firstName: string
  contentTitle: string
  contentType: string
  contentDescription: string
  contentAuthor: string
  contentLink: string
}

export function NewContentEmail({
  firstName,
  contentTitle,
  contentType,
  contentDescription,
  contentAuthor,
  contentLink,
}: NewContentEmailProps) {
  return (
    <EmailLayout previewText={`New ${contentType}: ${contentTitle}`}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <span
          style={{
            display: "inline-block",
            backgroundColor: "rgba(181, 96, 74, 0.1)",
            color: "#b5604a",
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "6px 12px",
            borderRadius: "9999px",
          }}
        >
          New {contentType}
        </span>
      </div>

      <EmailHeading>{contentTitle}</EmailHeading>
      
      <EmailText>
        Hello {firstName},
      </EmailText>
      
      <EmailText>
        We&apos;ve just published something we think you&apos;ll love. As a valued member, 
        you get exclusive early access to our latest content.
      </EmailText>

      <div
        style={{
          backgroundColor: "#f8f6f2",
          borderRadius: "8px",
          padding: "24px",
          margin: "24px 0",
        }}
      >
        <p
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "18px",
            fontWeight: 500,
            color: "#1c1917",
            margin: "0 0 12px 0",
            lineHeight: 1.4,
          }}
        >
          {contentTitle}
        </p>
        <p
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: "14px",
            color: "#78716c",
            margin: "0 0 16px 0",
            lineHeight: 1.6,
          }}
        >
          {contentDescription}
        </p>
        <p
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: "13px",
            color: "#b5604a",
            margin: 0,
          }}
        >
          By {contentAuthor}
        </p>
      </div>

      <EmailButton href={contentLink}>
        Read Now →
      </EmailButton>

      <EmailDivider />

      <EmailText>
        This content is exclusively available to members. Share it with fellow members 
        who might find it valuable — together we grow stronger.
      </EmailText>

      <EmailText>
        Happy reading,<br />
        <strong style={{ color: "#1c1917" }}>The Yorkshire Businesswoman Team</strong>
      </EmailText>
    </EmailLayout>
  )
}
