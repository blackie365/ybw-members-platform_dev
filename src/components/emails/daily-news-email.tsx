/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { format } from "date-fns";

interface NewsStory {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  custom_excerpt?: string;
  feature_image?: string;
  published_at: string;
  reading_time?: number;
  featured?: boolean;
  primary_tag?: {
    name: string;
    slug: string;
  };
  primary_author?: {
    name: string;
  };
}

interface DailyNewsEmailProps {
  stories: NewsStory[];
  recipientName?: string;
  editorNote?: string;
  date?: Date;
  hideFooter?: boolean;
}

// Elegant color palette
const colors = {
  background: "#FAF8F5",
  card: "#FFFFFF",
  primary: "#1c1917",
  secondary: "#57534e",
  accent: "#a3413a",
  border: "#e7e5e4",
  muted: "#f5f5f4"
};

const fonts = {
  serif: "'Playfair Display', Georgia, 'Times New Roman', serif",
  sans: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif"
};

export function DailyNewsEmail({
  stories,
  recipientName,
  editorNote,
  date = new Date(),
  hideFooter = false
}: DailyNewsEmailProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://yorkshirebusinesswoman.co.uk";
  const formattedDate = format(date, "EEEE, MMMM d, yyyy");
  const featuredStory = stories[0];
  const remainingStories = stories.slice(1, 5);

  return (
    <div style={{ backgroundColor: colors.background, margin: 0, padding: 0 }}>
      {/* Preview text */}
      <div
        style={{
          display: "none",
          maxHeight: 0,
          overflow: "hidden",
          fontSize: "1px",
          lineHeight: "1px",
          color: colors.background
        }}>
        
        Your weekly briefing: {featuredStory?.title || "Today's top stories"}
      </div>

      <table
        cellPadding="0"
        cellSpacing="0"
        width="100%"
        style={{ backgroundColor: colors.background }}>
        
        <tbody>
          <tr>
            <td align="center" style={{ padding: "40px 16px" }}>
              {/* Main Container */}
              <table
                cellPadding="0"
                cellSpacing="0"
                width="100%"
                style={{
                  maxWidth: "640px",
                  backgroundColor: colors.card,
                  borderRadius: "2px"
                }}>
                
                <tbody>
                  {/* Header */}
                  <tr>
                    <td
                      style={{
                        padding: "40px 40px 32px 40px",
                        borderBottom: `1px solid ${colors.border}`
                      }}>
                      
                      <table cellPadding="0" cellSpacing="0" width="100%">
                        <tbody>
                          <tr>
                            <td align="center">
                              <img
                                src="https://img.rocket.new/generatedImages/rocket_gen_img_1545cfed3-1772247582674.png"
                                alt="Yorkshire Businesswoman"
                                style={{
                                  maxHeight: "48px",
                                  width: "auto",
                                  display: "block"
                                }} />
                              
                            </td>
                          </tr>
                          <tr>
                            <td
                              align="center"
                              style={{
                                paddingTop: "20px"
                              }}>
                              
                              <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "11px",
                                  fontWeight: 500,
                                  letterSpacing: "3px",
                                  textTransform: "uppercase",
                                  color: colors.accent,
                                  margin: 0
                                }}>
                                
                                Weekly News Digest
                              </p>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Date & Greeting */}
                  <tr>
                    <td style={{ padding: "40px 40px 0 40px" }}>
                      <table cellPadding="0" cellSpacing="0" width="100%">
                        <tbody>
                          <tr>
                            <td align="center">
                              <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  letterSpacing: "2px",
                                  textTransform: "uppercase",
                                  color: colors.secondary,
                                  margin: "0 0 16px 0"
                                }}>
                                
                                {formattedDate}
                              </p>
                              <h1
                                style={{
                                  fontFamily: fonts.serif,
                                  fontSize: "32px",
                                  fontWeight: 400,
                                  color: colors.primary,
                                  margin: "0 0 12px 0",
                                  lineHeight: 1.2
                                }}>
                                
                                {recipientName ?
                                `Good morning, ${recipientName}.` :
                                "Good morning."}
                              </h1>
                              <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "11px",
                                  color: colors.secondary,
                                  margin: 0,
                                  lineHeight: 1.6
                                }}>
                                
                                    Here are this week&apos;s top stories from across Yorkshire.
                                  </p>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Editor's Note (optional) */}
                  {editorNote &&
                  <tr>
                      <td style={{ padding: "32px 40px 0 40px" }}>
                        <table
                        cellPadding="0"
                        cellSpacing="0"
                        width="100%"
                        style={{
                          backgroundColor: colors.muted,
                          borderLeft: `3px solid ${colors.accent}`
                        }}>
                        
                          <tbody>
                            <tr>
                              <td style={{ padding: "24px" }}>
                                <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  letterSpacing: "2px",
                                  textTransform: "uppercase",
                                  color: colors.accent,
                                  margin: "0 0 12px 0"
                                }}>
                                
                                  From the Editor
                                </p>
                                <p
                                style={{
                                  fontFamily: fonts.serif,
                                  fontSize: "11px",
                                  fontStyle: "italic",
                                  color: colors.primary,
                                  margin: 0,
                                  lineHeight: 1.7
                                }}>
                                
                                    {editorNote}
                                  </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  }

                  {/* Featured Story */}
                  {featuredStory &&
                  <tr>
                      <td style={{ padding: "40px 40px 0 40px" }}>
                        <table cellPadding="0" cellSpacing="0" width="100%">
                          <tbody>
                            <tr>
                              <td>
                                <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  letterSpacing: "3px",
                                  textTransform: "uppercase",
                                  color: colors.accent,
                                  margin: "0 0 20px 0"
                                }}>
                                
                                  Featured Article
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <a
                                href={`${siteUrl}/news/${featuredStory.slug}`}
                                style={{
                                  textDecoration: "none",
                                  color: "inherit"
                                }}>
                                
                                  {featuredStory.feature_image &&
                                <img
                                  src={featuredStory.feature_image}
                                  alt={featuredStory.title}
                                  style={{
                                    width: "100%",
                                    height: "auto",
                                    aspectRatio: "16/9",
                                    objectFit: "cover",
                                    display: "block",
                                    marginBottom: "24px"
                                  }} />

                                }
                                  <table
                                  cellPadding="0"
                                  cellSpacing="0"
                                  width="100%">
                                  
                                    <tbody>
                                      <tr>
                                        <td>
                                          {featuredStory.primary_tag &&
                                        <p
                                          style={{
                                            fontFamily: fonts.sans,
                                            fontSize: "11px",
                                            fontWeight: 500,
                                            letterSpacing: "1.5px",
                                            textTransform: "uppercase",
                                            color: colors.accent,
                                            margin: "0 0 10px 0"
                                          }}>
                                          
                                              {featuredStory.primary_tag.name}
                                            </p>
                                        }
                                          <h2
                                          style={{
                                            fontFamily: fonts.serif,
                                            fontSize: "26px",
                                            fontWeight: 400,
                                            color: colors.primary,
                                            margin: "0 0 14px 0",
                                            lineHeight: 1.3
                                          }}>
                                          
                                            {featuredStory.title}
                                          </h2>
                                          <p
                                          style={{
                                            fontFamily: fonts.sans,
                                            fontSize: "11px",
                                            color: colors.secondary,
                                            margin: "0 0 16px 0",
                                            lineHeight: 1.7
                                          }}>
                                          
                                            {featuredStory.custom_excerpt ||
                                          featuredStory.excerpt}
                                          </p>
                                          <p
                                          style={{
                                            fontFamily: fonts.sans,
                                            fontSize: "12px",
                                            color: colors.secondary,
                                            margin: 0
                                          }}>
                                          
                                            {featuredStory.primary_author?.name ||
                                          "YBW Editorial"}{" "}
                                            &middot;{" "}
                                            {featuredStory.reading_time || 3} min
                                            read
                                          </p>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  }

                  {/* Divider */}
                  <tr>
                    <td style={{ padding: "32px 40px" }}>
                      <hr
                        style={{
                          border: "none",
                          borderTop: `1px solid ${colors.border}`,
                          margin: 0
                        }} />
                      
                    </td>
                  </tr>

                  {/* Latest News Section */}
                  {remainingStories.length > 0 &&
                  <tr>
                      <td style={{ padding: "0 40px" }}>
                        <p
                        style={{
                          fontFamily: fonts.sans,
                          fontSize: "10px",
                          fontWeight: 600,
                          letterSpacing: "3px",
                          textTransform: "uppercase",
                          color: colors.accent,
                          margin: "0 0 24px 0"
                        }}>
                        
                          Weekly Highlights
                        </p>

                        {remainingStories.map((story, index) =>
                      <table
                        key={story.id}
                        cellPadding="0"
                        cellSpacing="0"
                        width="100%"
                        style={{
                          marginBottom:
                          index < remainingStories.length - 1 ? "24px" : 0,
                          paddingBottom:
                          index < remainingStories.length - 1 ? "24px" : 0,
                          borderBottom:
                          index < remainingStories.length - 1 ?
                          `1px solid ${colors.border}` :
                          "none"
                        }}>
                        
                            <tbody>
                              <tr>
                                <td
                              style={{
                                width: "120px",
                                verticalAlign: "top",
                                paddingRight: "20px"
                              }}>
                              
                                  <a
                                href={`${siteUrl}/news/${story.slug}`}
                                style={{
                                  textDecoration: "none"
                                }}>
                                
                                    {story.feature_image ?
                                <img
                                  src={story.feature_image}
                                  alt={story.title}
                                  style={{
                                    width: "120px",
                                    height: "80px",
                                    objectFit: "cover",
                                    display: "block"
                                  }} /> :


                                <div
                                  style={{
                                    width: "120px",
                                    height: "80px",
                                    backgroundColor: colors.muted
                                  }} />

                                }
                                  </a>
                                </td>
                                <td style={{ verticalAlign: "top" }}>
                                  <a
                                href={`${siteUrl}/news/${story.slug}`}
                                style={{
                                  textDecoration: "none",
                                  color: "inherit"
                                }}>
                                
                                    {story.primary_tag &&
                                <p
                                  style={{
                                    fontFamily: fonts.sans,
                                    fontSize: "10px",
                                    fontWeight: 500,
                                    letterSpacing: "1.5px",
                                    textTransform: "uppercase",
                                    color: colors.accent,
                                    margin: "0 0 6px 0"
                                  }}>
                                  
                                        {story.primary_tag.name}
                                      </p>
                                }
                                    <h3
                                  style={{
                                    fontFamily: fonts.serif,
                                    fontSize: "17px",
                                    fontWeight: 400,
                                    color: colors.primary,
                                    margin: "0 0 8px 0",
                                    lineHeight: 1.35
                                  }}>
                                  
                                      {story.title}
                                    </h3>
                                    <p
                                  style={{
                                    fontFamily: fonts.sans,
                                    fontSize: "11px",
                                    color: colors.secondary,
                                    margin: 0,
                                    lineHeight: 1.5,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden"
                                  }}>
                                  
                                      {story.custom_excerpt || story.excerpt}
                                    </p>
                                  </a>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                      )}
                      </td>
                    </tr>
                  }

                  {/* Advertise Services Section */}
                  <tr>
                    <td style={{ padding: "40px 40px 0 40px" }}>
                      <table
                        cellPadding="0"
                        cellSpacing="0"
                        width="100%"
                        style={{
                          backgroundColor: "#1c1917", // Dark elegant background
                          borderRadius: "4px",
                          overflow: "hidden"
                        }}>
                        
                        <tbody>
                          <tr>
                            <td style={{ padding: "40px", textAlign: "center" }}>
                              <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  letterSpacing: "3px",
                                  textTransform: "uppercase",
                                  color: colors.accent,
                                  margin: "0 0 16px 0"
                                }}>
                                
                                Member Opportunity
                              </p>
                              <h2
                                style={{
                                  fontFamily: fonts.serif,
                                  fontSize: "24px",
                                  fontWeight: 400,
                                  color: "#FFFFFF",
                                  margin: "0 0 12px 0",
                                  lineHeight: 1.3
                                }}>
                                
                                Showcase Your Business
                              </h2>
                              <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "14px",
                                  color: "#a8a29e",
                                  margin: "0 0 24px 0",
                                  lineHeight: 1.6,
                                  maxWidth: "400px",
                                  marginLeft: "auto",
                                  marginRight: "auto"
                                }}>
                                
                                Reach our exclusive network of ambitious women. Advertise your services directly to the Yorkshire Businesswoman community.
                              </p>
                              <a
                                href="mailto:editor@yorkshirebusinesswoman.co.uk"
                                style={{
                                  display: "inline-block",
                                  fontFamily: fonts.sans,
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  letterSpacing: "2px",
                                  textTransform: "uppercase",
                                  color: "#1c1917",
                                  backgroundColor: colors.accent,
                                  padding: "14px 28px",
                                  textDecoration: "none",
                                  borderRadius: "2px"
                                }}>
                                
                                Advertise Your Services
                              </a>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Divider */}
                  <tr>
                    <td style={{ padding: "32px 40px" }}>
                      <hr
                        style={{
                          border: "none",
                          borderTop: `1px solid ${colors.border}`,
                          margin: 0
                        }} />
                      
                    </td>
                  </tr>

                  {/* CTA Section */}
                  <tr>
                    <td style={{ padding: "0 40px 40px 40px" }}>
                      <table cellPadding="0" cellSpacing="0" width="100%">
                        <tbody>
                          <tr>
                            <td align="center">
                              <h3
                                style={{
                                  fontFamily: fonts.serif,
                                  fontSize: "22px",
                                  fontWeight: 400,
                                  color: colors.primary,
                                  margin: "0 0 12px 0",
                                  lineHeight: 1.3
                                }}>
                                
                                Explore more on Yorkshire Businesswoman
                              </h3>
                              <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "11px",
                                  color: colors.secondary,
                                  margin: "0 0 24px 0",
                                  lineHeight: 1.6
                                }}>
                                
                                    Discover leadership insights, career strategies,
                                    and inspiring stories.
                                  </p>
                              <a
                                href={`${siteUrl}/new-edition`}
                                style={{
                                  display: "inline-block",
                                  fontFamily: fonts.sans,
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  letterSpacing: "2px",
                                  textTransform: "uppercase",
                                  color: colors.card,
                                  backgroundColor: colors.primary,
                                  padding: "14px 32px",
                                  textDecoration: "none"
                                }}>
                                
                                Visit the Magazine
                              </a>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Footer */}
                  {!hideFooter &&
                  <tr>
                      <td
                      style={{
                        padding: "32px 40px",
                        borderTop: `1px solid ${colors.border}`,
                        backgroundColor: colors.muted
                      }}>
                      
                        <table cellPadding="0" cellSpacing="0" width="100%">
                          <tbody>
                            <tr>
                              <td align="center">
                                <img
                                src="https://img.rocket.new/generatedImages/rocket_gen_img_1545cfed3-1772247582674.png"
                                alt="Yorkshire Businesswoman"
                                style={{
                                  maxHeight: "36px",
                                  width: "auto",
                                  display: "block",
                                  marginBottom: "16px"
                                }} />
                              
                                <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "11px",
                                  color: colors.secondary,
                                  margin: "0 0 16px 0",
                                  lineHeight: 1.6
                                }}>
                                
                                  Empowering women in business across Yorkshire.
                                </p>
                                <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "12px",
                                  margin: "0 0 20px 0"
                                }}>
                                
                                  <a
                                  href="https://www.linkedin.com/company/yorkshire-businesswoman"
                                  style={{
                                    color: colors.secondary,
                                    textDecoration: "none"
                                  }}>
                                  
                                    LinkedIn
                                  </a>
                                  <span
                                  style={{
                                    color: colors.border,
                                    margin: "0 10px"
                                  }}>
                                  
                                    &middot;
                                  </span>
                                  <a
                                  href="https://twitter.com/YorksBizWoman"
                                  style={{
                                    color: colors.secondary,
                                    textDecoration: "none"
                                  }}>
                                  
                                    Twitter
                                  </a>
                                  <span
                                  style={{
                                    color: colors.border,
                                    margin: "0 10px"
                                  }}>
                                  
                                    &middot;
                                  </span>
                                  <a
                                  href="https://www.facebook.com/YorkshireBusinesswoman"
                                  style={{
                                    color: colors.secondary,
                                    textDecoration: "none"
                                  }}>
                                  
                                    Facebook
                                  </a>
                                  <span
                                  style={{
                                    color: colors.border,
                                    margin: "0 10px"
                                  }}>
                                  
                                    &middot;
                                  </span>
                                  <a
                                  href="https://www.instagram.com/yorkshire_businesswoman"
                                  style={{
                                    color: colors.secondary,
                                    textDecoration: "none"
                                  }}>
                                  
                                    Instagram
                                  </a>
                                </p>
                                <hr
                                style={{
                                  border: "none",
                                  borderTop: `1px solid ${colors.border}`,
                                  margin: "0 0 16px 0"
                                }} />
                              
                                <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "11px",
                                  color: colors.secondary,
                                  margin: "0 0 8px 0"
                                }}>
                                
                                  You received this email because you subscribed to
                                  the Weekly News Digest.
                                </p>
                                <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "11px",
                                  margin: 0
                                }}>
                                
                                  <a
                                  href={`${siteUrl}/dashboard/profile`}
                                  style={{
                                    color: colors.accent,
                                    textDecoration: "none"
                                  }}>
                                  
                                    Manage preferences
                                  </a>
                                  <span
                                  style={{
                                    color: colors.border,
                                    margin: "0 8px"
                                  }}>
                                  
                                    &middot;
                                  </span>
                                  <a
                                  href={`${siteUrl}/unsubscribe`}
                                  style={{
                                    color: colors.accent,
                                    textDecoration: "none"
                                  }}>
                                  
                                    Unsubscribe
                                  </a>
                                </p>
                                <p
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: "10px",
                                  color: colors.secondary,
                                  margin: "16px 0 0 0"
                                }}>
                                
                                  Yorkshire Businesswoman &middot; 10 Shetland Drive, Congleton, England, CW12 4FN
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>);

}

/**
 * Generate static HTML string for the email
 * Use this for sending via email service
 */
export function generateDailyNewsEmailHtml(props: DailyNewsEmailProps): string {
  const { stories, recipientName, editorNote, date = new Date() } = props;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://yorkshirebusinesswoman.co.uk";
  const formattedDate = format(date, "EEEE, MMMM d, yyyy");
  const featuredStory = stories[0];
  const remainingStories = stories.slice(1, 5);

  const moreStoriesHtml = remainingStories.
  map(
    (story, index) => `
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: ${index < remainingStories.length - 1 ? "24px" : "0"}; padding-bottom: ${index < remainingStories.length - 1 ? "24px" : "0"}; border-bottom: ${index < remainingStories.length - 1 ? `1px solid ${colors.border}` : "none"};">
        <tr>
          <td style="width: 120px; vertical-align: top; padding-right: 20px;">
            <a href="${siteUrl}/news/${story.slug}" style="text-decoration: none;">
              ${story.feature_image ? `<img src="${story.feature_image}" alt="${story.title}" style="width: 120px; height: 80px; object-fit: cover; display: block;" />` : `<div style="width: 120px; height: 80px; background-color: ${colors.muted};"></div>`}
            </a>
          </td>
          <td style="vertical-align: top;">
            <a href="${siteUrl}/news/${story.slug}" style="text-decoration: none; color: inherit;">
              ${story.primary_tag ? `<p style="font-family: ${fonts.sans}; font-size: 10px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase; color: ${colors.accent}; margin: 0 0 6px 0;">${story.primary_tag.name}</p>` : ""}
              <h3 style="font-family: ${fonts.serif}; font-size: 17px; font-weight: 400; color: ${colors.primary}; margin: 0 0 8px 0; line-height: 1.35;">${story.title}</h3>
              <p style="font-family: ${fonts.sans}; font-size: 13px; color: ${colors.secondary}; margin: 0; line-height: 1.5;">${story.custom_excerpt || story.excerpt || ""}</p>
            </a>
          </td>
        </tr>
      </table>
    `
  ).
  join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Weekly News Digest - Yorkshire Businesswoman</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse: collapse;}
    .fallback-font {font-family: Georgia, serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.background}; -webkit-font-smoothing: antialiased;">
  <!-- Preview text -->
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: ${colors.background};">
    Your weekly briefing: ${featuredStory?.title || "Today's top stories"}
  </div>

  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: ${colors.background};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        
        <!-- Main Container -->
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; background-color: ${colors.card}; border-radius: 2px;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 32px 40px; border-bottom: 1px solid ${colors.border};">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <img src="https://yorkshirebusinesswoman.co.uk/images/logo-nav-v3.png" alt="Yorkshire Businesswoman" style="max-height: 48px; width: auto; display: block;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 20px;">
                    <p style="font-family: ${fonts.sans}; font-size: 11px; font-weight: 500; letter-spacing: 3px; text-transform: uppercase; color: ${colors.accent}; margin: 0;">Weekly News Digest</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Date & Greeting -->
          <tr>
            <td style="padding: 40px 40px 0 40px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
              <p style="font-family: ${fonts.sans}; font-size: 12px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: ${colors.secondary}; margin: 0 0 16px 0;">${formattedDate}</p>
              <p style="font-family: ${fonts.sans}; font-size: 11px; color: ${colors.secondary}; margin: 0 0 16px 0; line-height: 1.2;">${recipientName ? `Good morning, ${recipientName}.` : "Good morning."}</p>
              <p style="font-family: ${fonts.sans}; font-size: 11px; color: ${colors.secondary}; margin: 0; line-height: 1.6;">Here are this week's top stories from across Yorkshire.</p>
            </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
  editorNote ?
  `
          <!-- Editor's Note -->
          <tr>
            <td style="padding: 32px 40px 0 40px;">
              <table cellpadding="0" cellspacing="0" width="100%" style="background-color: ${colors.muted}; border-left: 3px solid ${colors.accent};">
                <tr>
                  <td style="padding: 24px;">
                    <p style="font-family: ${fonts.sans}; font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: ${colors.accent}; margin: 0 0 12px 0;">From the Editor</p>
                    <p style="font-family: ${fonts.serif}; font-size: 11px; font-style: italic; color: ${colors.primary}; margin: 0; line-height: 1.7;">${editorNote}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` :
  ""}

          ${

  featuredStory ?
  `
          <!-- Featured Story -->
          <tr>
            <td style="padding: 40px 40px 0 40px;">
              <p style="font-family: ${fonts.sans}; font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: ${colors.accent}; margin: 0 0 20px 0;">Lead Story</p>
              <a href="${siteUrl}/news/${featuredStory.slug}" style="text-decoration: none; color: inherit;">
                ${featuredStory.feature_image ? `<img src="${featuredStory.feature_image}" alt="${featuredStory.title}" style="width: 100%; height: auto; display: block; margin-bottom: 24px;" />` : ""}
                ${featuredStory.primary_tag ? `<p style="font-family: ${fonts.sans}; font-size: 11px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase; color: ${colors.accent}; margin: 0 0 10px 0;">${featuredStory.primary_tag.name}</p>` : ""}
                <h2 style="font-family: ${fonts.serif}; font-size: 26px; font-weight: 400; color: ${colors.primary}; margin: 0 0 14px 0; line-height: 1.3;">${featuredStory.title}</h2>
                <p style="font-family: ${fonts.sans}; font-size: 11px; color: ${colors.secondary}; margin: 0 0 16px 0; line-height: 1.7;">${featuredStory.custom_excerpt || featuredStory.excerpt || ""}</p>
                <p style="font-family: ${fonts.sans}; font-size: 12px; color: ${colors.secondary}; margin: 0;">${featuredStory.primary_author?.name || "YBW Editorial"} &middot; ${featuredStory.reading_time || 3} min read</p>
              </a>
            </td>
          </tr>
          ` :
  ""}

          <!-- Divider -->
          <tr>
            <td style="padding: 32px 40px;">
              <hr style="border: none; border-top: 1px solid ${
  colors.border}; margin: 0;" />
            </td>
          </tr>

          ${
  remainingStories.length > 0 ?
  `
          <!-- More Stories -->
          <tr>
            <td style="padding: 0 40px;">
              <p style="font-family: ${fonts.sans}; font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: ${colors.accent}; margin: 0 0 24px 0;">Weekly Highlights</p>
              ${moreStoriesHtml}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 32px 40px;">
              <hr style="border: none; border-top: 1px solid ${colors.border}; margin: 0;" />
            </td>
          </tr>
          ` :
  ""}

          <!-- Advertise Services Section -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #1c1917; border-radius: 4px; overflow: hidden;">
                <tr>
                  <td style="padding: 40px; text-align: center;">
                    <p style="font-family: ${
  fonts.sans}; font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: ${colors.accent}; margin: 0 0 16px 0;">Member Opportunity</p>
                    <h2 style="font-family: ${fonts.serif}; font-size: 24px; font-weight: 400; color: #FFFFFF; margin: 0 0 12px 0; line-height: 1.3;">Showcase Your Business</h2>
                    <p style="font-family: ${fonts.sans}; font-size: 14px; color: #a8a29e; margin: 0 0 24px 0; line-height: 1.6; max-width: 400px; margin-left: auto; margin-right: auto;">Reach our exclusive network of ambitious women. Advertise your services directly to the Yorkshire Businesswoman community.</p>
                    <a href="mailto:editor@yorkshirebusinesswoman.co.uk" style="display: inline-block; font-family: ${fonts.sans}; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #1c1917; background-color: ${colors.accent}; padding: 14px 28px; text-decoration: none; border-radius: 2px;">Advertise Your Services</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Section -->
          <tr>
            <td style="padding: 0 40px 40px 40px;" align="center">
              <h3 style="font-family: ${fonts.serif}; font-size: 22px; font-weight: 400; color: ${colors.primary}; margin: 0 0 12px 0; line-height: 1.3;">Explore more on Yorkshire Businesswoman</h3>
              <p style="font-family: ${fonts.sans}; font-size: 11px; color: ${colors.secondary}; margin: 0 0 24px 0; line-height: 1.6;">Discover leadership insights, career strategies, and inspiring stories.</p>
              <a href="${siteUrl}/new-edition" style="display: inline-block; font-family: ${fonts.sans}; font-size: 12px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: ${colors.card}; background-color: ${colors.primary}; padding: 14px 32px; text-decoration: none;">Visit the Magazine</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; border-top: 1px solid ${colors.border}; background-color: ${colors.muted};">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <img src="https://yorkshirebusinesswoman.co.uk/images/logo-nav-v3.png" alt="Yorkshire Businesswoman" style="max-height: 36px; width: auto; display: block; margin-bottom: 16px;" />
                    <p style="font-family: ${fonts.sans}; font-size: 11px; color: ${colors.secondary}; margin: 0 0 16px 0; line-height: 1.6;">Empowering women in business across Yorkshire.</p>
                    <p style="font-family: ${fonts.sans}; font-size: 11px; margin: 0 0 20px 0;">
                      <a href="https://www.linkedin.com/company/yorkshire-businesswoman" style="color: ${colors.secondary}; text-decoration: none;">LinkedIn</a>
                      <span style="color: ${colors.border}; margin: 0 10px;">&middot;</span>
                      <a href="https://twitter.com/YorksBizWoman" style="color: ${colors.secondary}; text-decoration: none;">Twitter</a>
                      <span style="color: ${colors.border}; margin: 0 10px;">&middot;</span>
                      <a href="https://www.facebook.com/YorkshireBusinesswoman" style="color: ${colors.secondary}; text-decoration: none;">Facebook</a>
                      <span style="color: ${colors.border}; margin: 0 10px;">&middot;</span>
                      <a href="https://www.instagram.com/yorkshire_businesswoman" style="color: ${colors.secondary}; text-decoration: none;">Instagram</a>
                    </p>
                    <hr style="border: none; border-top: 1px solid ${colors.border}; margin: 0 0 16px 0;" />
                    <p style="font-family: ${fonts.sans}; font-size: 11px; color: ${colors.secondary}; margin: 0 0 8px 0;">You received this email because you subscribed to the Weekly News Digest.</p>
                    <p style="font-family: ${fonts.sans}; font-size: 11px; margin: 0;">
                      <a href="${siteUrl}/dashboard/profile" style="color: ${colors.accent}; text-decoration: none;">Manage preferences</a>
                      <span style="color: ${colors.border}; margin: 0 8px;">&middot;</span>
                      <a href="${siteUrl}/unsubscribe" style="color: ${colors.accent}; text-decoration: none;">Unsubscribe</a>
                    </p>
                    <p style="font-family: ${fonts.sans}; font-size: 10px; color: ${colors.secondary}; margin: 16px 0 0 0;">Yorkshire Businesswoman &middot; 10 Shetland Drive, Congleton, England, CW12 4FN</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Main Container -->

      </td>
    </tr>
  </table>
</body>
</html>
  `;
}