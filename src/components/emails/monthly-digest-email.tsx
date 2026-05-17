import {
  EmailLayout,
  EmailHeading,
  EmailSubheading,
  EmailText,
  EmailButton,
  EmailDivider,
} from "./email-layout"

interface MonthlyDigestEmailProps {
  firstName: string
  monthYear: string
  stats: {
    newResources: number
    upcomingEvents: number
    newMembers: number
  }
  featuredContent: Array<{
    title: string
    type: string
    link: string
  }>
  upcomingEvents: Array<{
    title: string
    date: string
    link: string
  }>
}

export function MonthlyDigestEmail({
  firstName,
  monthYear,
  stats,
  featuredContent,
  upcomingEvents,
}: MonthlyDigestEmailProps) {
  return (
    <EmailLayout previewText={`Your ${monthYear} digest from Yorkshire Businesswoman`}>
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
          Monthly Digest
        </span>
      </div>

      <EmailHeading>{monthYear} Roundup</EmailHeading>
      
      <EmailText>
        Hello {firstName},
      </EmailText>
      
      <EmailText>
        Here&apos;s what&apos;s been happening in the Yorkshire Businesswoman community this month, 
        plus a preview of what&apos;s coming up.
      </EmailText>

      {/* Stats Grid */}
      <table cellPadding="0" cellSpacing="0" width="100%" style={{ margin: "24px 0" }}>
        <tbody>
          <tr>
            <td style={{ width: "33.33%", padding: "12px", textAlign: "center" }}>
              <div
                style={{
                  backgroundColor: "#f8f6f2",
                  borderRadius: "8px",
                  padding: "20px 12px",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: "32px",
                    fontWeight: 500,
                    color: "#b5604a",
                    margin: "0 0 4px 0",
                  }}
                >
                  {stats.newResources}
                </p>
                <p
                  style={{
                    fontFamily: "'Inter', Arial, sans-serif",
                    fontSize: "12px",
                    color: "#78716c",
                    margin: 0,
                  }}
                >
                  New Resources
                </p>
              </div>
            </td>
            <td style={{ width: "33.33%", padding: "12px", textAlign: "center" }}>
              <div
                style={{
                  backgroundColor: "#f8f6f2",
                  borderRadius: "8px",
                  padding: "20px 12px",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: "32px",
                    fontWeight: 500,
                    color: "#b5604a",
                    margin: "0 0 4px 0",
                  }}
                >
                  {stats.upcomingEvents}
                </p>
                <p
                  style={{
                    fontFamily: "'Inter', Arial, sans-serif",
                    fontSize: "12px",
                    color: "#78716c",
                    margin: 0,
                  }}
                >
                  Upcoming Events
                </p>
              </div>
            </td>
            <td style={{ width: "33.33%", padding: "12px", textAlign: "center" }}>
              <div
                style={{
                  backgroundColor: "#f8f6f2",
                  borderRadius: "8px",
                  padding: "20px 12px",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: "32px",
                    fontWeight: 500,
                    color: "#b5604a",
                    margin: "0 0 4px 0",
                  }}
                >
                  {stats.newMembers}
                </p>
                <p
                  style={{
                    fontFamily: "'Inter', Arial, sans-serif",
                    fontSize: "12px",
                    color: "#78716c",
                    margin: 0,
                  }}
                >
                  New Members
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <EmailDivider />

      <EmailSubheading>Featured Content</EmailSubheading>
      
      {featuredContent.map((content, index) => (
        <a
          key={index}
          href={content.link}
          style={{
            display: "block",
            backgroundColor: "#f8f6f2",
            borderRadius: "6px",
            padding: "16px 20px",
            marginBottom: "12px",
            textDecoration: "none",
          }}
        >
          <p
            style={{
              fontFamily: "'Inter', Arial, sans-serif",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#b5604a",
              margin: "0 0 4px 0",
            }}
          >
            {content.type}
          </p>
          <p
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "16px",
              fontWeight: 500,
              color: "#1c1917",
              margin: 0,
            }}
          >
            {content.title}
          </p>
        </a>
      ))}

      <EmailDivider />

      <EmailSubheading>Upcoming Events</EmailSubheading>
      
      {upcomingEvents.map((event, index) => (
        <a
          key={index}
          href={event.link}
          style={{
            display: "block",
            borderLeft: "3px solid #b5604a",
            paddingLeft: "16px",
            marginBottom: "16px",
            textDecoration: "none",
          }}
        >
          <p
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "16px",
              fontWeight: 500,
              color: "#1c1917",
              margin: "0 0 4px 0",
            }}
          >
            {event.title}
          </p>
          <p
            style={{
              fontFamily: "'Inter', Arial, sans-serif",
              fontSize: "13px",
              color: "#78716c",
              margin: 0,
            }}
          >
            {event.date}
          </p>
        </a>
      ))}

      <EmailButton href="https://yorkshirebusinesswoman.com/events">
        View All Events →
      </EmailButton>

      <EmailDivider />

      <EmailText>
        Thank you for being part of our community. Here&apos;s to another month of 
        growth, connection, and success.
      </EmailText>

      <EmailText>
        Warm regards,<br />
        <strong style={{ color: "#1c1917" }}>The Yorkshire Businesswoman Team</strong>
      </EmailText>
    </EmailLayout>
  )
}
