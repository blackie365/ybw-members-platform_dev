import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailHighlightBox,
  EmailDivider,
} from "./email-layout"

interface EventInvitationEmailProps {
  firstName: string
  eventTitle: string
  eventDate: string
  eventTime: string
  eventLocation: string
  eventDescription: string
  isOnline: boolean
  eventLink: string
}

export function EventInvitationEmail({
  firstName,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  eventDescription,
  isOnline,
  eventLink,
}: EventInvitationEmailProps) {
  return (
    <EmailLayout previewText={`You're invited: ${eventTitle} on ${eventDate}`}>
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
          {isOnline ? "Online Event" : "In-Person Event"}
        </span>
      </div>

      <EmailHeading>You&apos;re Invited</EmailHeading>
      
      <EmailText>
        Dear {firstName},
      </EmailText>
      
      <EmailText>
        We&apos;re excited to invite you to an exclusive member event. 
        This is a wonderful opportunity to connect, learn, and grow alongside 
        fellow businesswomen from across Yorkshire.
      </EmailText>

      <div
        style={{
          backgroundColor: "#242220",
          borderRadius: "8px",
          padding: "32px",
          margin: "24px 0",
          textAlign: "center",
        }}
      >
        <h3
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "24px",
            fontWeight: 500,
            color: "#f8f6f2",
            margin: "0 0 20px 0",
            lineHeight: 1.3,
          }}
        >
          {eventTitle}
        </h3>
        
        <table cellPadding="0" cellSpacing="0" style={{ margin: "0 auto" }}>
          <tbody>
            <tr>
              <td style={{ padding: "8px 16px", borderRight: "1px solid rgba(248, 246, 242, 0.2)" }}>
                <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "12px", color: "#b5604a", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Date
                </p>
                <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "14px", color: "#f8f6f2", margin: 0, fontWeight: 500 }}>
                  {eventDate}
                </p>
              </td>
              <td style={{ padding: "8px 16px", borderRight: "1px solid rgba(248, 246, 242, 0.2)" }}>
                <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "12px", color: "#b5604a", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Time
                </p>
                <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "14px", color: "#f8f6f2", margin: 0, fontWeight: 500 }}>
                  {eventTime}
                </p>
              </td>
              <td style={{ padding: "8px 16px" }}>
                <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "12px", color: "#b5604a", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Location
                </p>
                <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: "14px", color: "#f8f6f2", margin: 0, fontWeight: 500 }}>
                  {eventLocation}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <EmailText>
        {eventDescription}
      </EmailText>

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
          <strong style={{ color: "#1c1917" }}>Limited spaces available.</strong>
          {" "}Please RSVP as soon as possible to secure your spot at this exclusive member event.
        </p>
      </EmailHighlightBox>

      <EmailButton href={eventLink}>
        RSVP Now →
      </EmailButton>

      <EmailDivider />

      <EmailText>
        We can&apos;t wait to see you there. If you have any questions about the event, 
        simply reply to this email.
      </EmailText>

      <EmailText>
        See you soon,<br />
        <strong style={{ color: "#1c1917" }}>The Yorkshire Businesswoman Team</strong>
      </EmailText>
    </EmailLayout>
  )
}
