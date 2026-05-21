require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// We need to use a slightly different approach to get the HTML since the template uses React components
// For simplicity and speed, I will generate a version that matches the design manually in HTML
// so it's guaranteed to be compatible with Beehiiv's import.

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Yorkshire Businesswoman Daily News</title>
  <style>
    body { font-family: 'Playfair Display', Georgia, serif; background-color: #FAF8F5; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 40px auto; background-color: #FFFFFF; border-radius: 2px; }
    .header { padding: 40px; text-align: center; border-bottom: 1px solid #e7e5e4; }
    .logo { max-height: 48px; width: auto; }
    .label { font-family: sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 3px; text-transform: uppercase; color: #b79c65; margin-top: 20px; }
    .content { padding: 40px; text-align: center; }
    .date { font-family: sans-serif; font-size: 12px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: #57534e; margin-bottom: 16px; }
    .greeting { font-size: 32px; color: #1c1917; margin-bottom: 12px; line-height: 1.2; }
    .intro { font-family: sans-serif; font-size: 15px; color: #57534e; line-height: 1.6; }
    .footer { padding: 40px; text-align: center; border-top: 1px solid #e7e5e4; font-family: sans-serif; font-size: 12px; color: #71717a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://yorkshirebusinesswoman.co.uk/images/logo-nav-v3.png" alt="Yorkshire Businesswoman" class="logo">
      <div class="label">Daily News Digest</div>
    </div>
    <div class="content">
      <div class="date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <h1 class="greeting">Good morning, {{subscriber.first_name}}.</h1>
      <p class="intro">Here are today's top stories from across Yorkshire.</p>
      
      <!-- BEEHIIV DYNAMIC POSTS START -->
      <div style="margin-top: 40px; text-align: left;">
        {{#rp_posts}}
          <div style="margin-bottom: 30px;">
            <img src="{{post.feature_image}}" style="width: 100%; border-radius: 2px; margin-bottom: 15px;">
            <h2 style="font-size: 24px; color: #1c1917; margin-bottom: 10px;">{{post.title}}</h2>
            <p style="font-family: sans-serif; font-size: 14px; color: #57534e; line-height: 1.5;">{{post.excerpt}}</p>
            <a href="{{post.url}}" style="color: #b79c65; text-decoration: none; font-weight: bold; font-family: sans-serif; font-size: 14px;">Read More →</a>
          </div>
        {{/rp_posts}}
      </div>
      <!-- BEEHIIV DYNAMIC POSTS END -->
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Yorkshire Businesswoman. All rights reserved.<br>
      You are receiving this email because you are a member of our community.<br>
      <a href="{{unsubscribe_url}}" style="color: #b79c65; text-decoration: underline;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>
`;

const outputPath = path.join(process.cwd(), 'beehiiv-newsletter-template.html');
fs.writeFileSync(outputPath, htmlTemplate);
console.log('✅ Beehiiv template created successfully!');
