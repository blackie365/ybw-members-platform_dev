const getEmailLayout = (title: string, content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
  </style>
</head>
<body style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f8f6f2; margin: 0; padding: 40px 20px; color: #1c1917;">
  
  <table cellPadding="0" cellSpacing="0" style="max-width: 600px; margin: 0 auto; background-color: #fffefb; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);" width="100%">
    <tbody>
      <!-- HEADER -->
      <tr>
        <td style="background-color: #242220; padding: 32px 40px; text-align: center;">
          <img src="https://yorkshirebusinesswoman.co.uk/images/logo-footer-v2.png" alt="Yorkshire Businesswoman" style="max-height: 40px; width: auto;" />
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding: 40px 40px 10px 40px;">
          ${content}
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background-color: #f8f6f2; padding: 32px 40px; text-align: center; border-top: 1px solid #e5e2db;">
          <p style="font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #a8a29e; margin: 0 0 8px 0;">© ${new Date().getFullYear()} Yorkshire Businesswoman. All rights reserved.</p>
          <p style="font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #a8a29e; margin: 0;">
            <a href="https://yorkshirebusinesswoman.co.uk" style="color: #a8a29e; text-decoration: underline;">yorkshirebusinesswoman.co.uk</a>
            <span style="margin: 0 8px;">|</span>
            <a href="mailto:hello@yorkshirebusinesswoman.co.uk" style="color: #a8a29e; text-decoration: underline;">Contact Support</a>
          </p>
        </td>
      </tr>

    </tbody>
  </table>
</body>
</html>
`;

export const getWelcomeEmailTemplate = (firstName: string, appUrl: string) => {
  const content = `
    <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #1c1917; font-size: 26px; margin-top: 0; margin-bottom: 24px; font-weight: 500; letter-spacing: -0.01em;">Welcome to the Community</h1>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">Dear ${firstName},</p>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">We're absolutely delighted to welcome you to the Yorkshire Businesswoman community. Your premium membership is now active, and you're part of a thriving network of ambitious women building remarkable businesses across Yorkshire.</p>
    
    <!-- QUOTE BOX -->
    <div style="background-color: #f8f6f2; border-left: 4px solid #b5604a; padding: 20px 24px; margin: 24px 0; border-radius: 0 6px 6px 0;">
      <p style="font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-weight: 500; color: #1c1917; margin: 0 0 8px 0; font-style: italic;">"Alone we can do so little; together we can do so much."</p>
      <p style="font-family: 'Inter', Arial, sans-serif; font-size: 13px; color: #78716c; margin: 0;">— Helen Keller</p>
    </div>
    
    <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 500; color: #1c1917; margin: 32px 0 16px 0;">Getting Started</h2>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">Here's what you can do right now:</p>
    
    <!-- LIST -->
    <table cellPadding="0" cellSpacing="0" width="100%" style="margin-bottom: 16px;">
      <tbody>
        <tr>
          <td style="padding: 8px 0; vertical-align: top; width: 24px;">
            <span style="color: #b5604a; font-weight: 600;">1.</span>
          </td>
          <td style="padding: 8px 0;">
            <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin: 0; line-height: 1.6;">
              <strong style="color: #1c1917;">Complete your profile</strong> — Let other members get to know you and your business.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; vertical-align: top; width: 24px;">
            <span style="color: #b5604a; font-weight: 600;">2.</span>
          </td>
          <td style="padding: 8px 0;">
            <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin: 0; line-height: 1.6;">
              <strong style="color: #1c1917;">Set your Coaching status</strong> — Let others know if you are open to coaching or seeking a coach.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; vertical-align: top; width: 24px;">
            <span style="color: #b5604a; font-weight: 600;">3.</span>
          </td>
          <td style="padding: 8px 0;">
            <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin: 0; line-height: 1.6;">
              <strong style="color: #1c1917;">Browse the Directory</strong> — Start making meaningful connections with other members!
            </p>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- BUTTON -->
    <table cellPadding="0" cellSpacing="0" style="margin: 24px 0;">
      <tbody>
        <tr>
          <td>
            <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #b5604a; color: #fffefb; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 500; padding: 14px 28px; border-radius: 6px; text-decoration: none;">Access Your Dashboard →</a>
          </td>
        </tr>
      </tbody>
    </table>

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 32px; line-height: 1.6;">If you have any questions, simply reply to this email — we're here to help.</p>
  `;
  return getEmailLayout('Welcome to Yorkshire Businesswoman', content);
};

export const getFreeWelcomeEmailTemplate = (firstName: string, appUrl: string) => {
  const content = `
    <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #1c1917; font-size: 26px; margin-top: 0; margin-bottom: 24px; font-weight: 500; letter-spacing: -0.01em;">Welcome to the Community</h1>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">Dear ${firstName},</p>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">Thank you for registering as a Free Subscriber. We are absolutely thrilled to have you with us!</p>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">You will now receive our weekly newsletters, community updates, and event notifications straight to your inbox.</p>
    
    <!-- QUOTE BOX -->
    <div style="background-color: #f8f6f2; border-left: 4px solid #b5604a; padding: 20px 24px; margin: 24px 0; border-radius: 0 6px 6px 0;">
      <h3 style="font-family: 'Playfair Display', Georgia, serif; color: #1c1917; margin-top: 0; margin-bottom: 12px; font-size: 18px; font-weight: 500;">Want to get more involved?</h3>
      <p style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #78716c; margin: 0; line-height: 1.6;">If you ever want to unlock full access to the Member Directory, publish your own public profile, and get priority event booking, you can upgrade to a Premium Membership at any time from your dashboard.</p>
    </div>

    <!-- BUTTON -->
    <table cellPadding="0" cellSpacing="0" style="margin: 24px 0;">
      <tbody>
        <tr>
          <td>
            <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #b5604a; color: #fffefb; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 500; padding: 14px 28px; border-radius: 6px; text-decoration: none;">Access Your Dashboard →</a>
          </td>
        </tr>
      </tbody>
    </table>

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 32px; line-height: 1.6;">If you have any questions, simply reply to this email — we're here to help.</p>
  `;
  return getEmailLayout('Welcome to Yorkshire Businesswoman', content);
};

export const getEventTicketConfirmationEmailTemplate = (firstName: string, appUrl: string) => {
  const content = `
    <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #1c1917; font-size: 26px; margin-top: 0; margin-bottom: 24px; font-weight: 500; letter-spacing: -0.01em;">You're going to the event!</h1>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">Hi ${firstName},</p>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">This email confirms your successful ticket purchase and RSVP.</p>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 24px; line-height: 1.6;">Your name has been automatically added to the guest list. You can view the event details and see who else is attending by visiting the event page on the Yorkshire Businesswoman platform.</p>

    <!-- BUTTON -->
    <table cellPadding="0" cellSpacing="0" style="margin: 24px 0;">
      <tbody>
        <tr>
          <td>
            <a href="${appUrl}/events" style="display: inline-block; background-color: #b5604a; color: #fffefb; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 500; padding: 14px 28px; border-radius: 6px; text-decoration: none;">View Event Details →</a>
          </td>
        </tr>
      </tbody>
    </table>

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 32px; line-height: 1.6;">We look forward to seeing you there!</p>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 32px; line-height: 1.6;">
      Warm regards,<br>
      <strong style="color: #1c1917;">The Yorkshire Businesswoman Team</strong>
    </p>
  `;
  return getEmailLayout('Your Ticket Confirmation', content);
};

export const getPasswordResetEmailTemplate = (firstName: string, resetLink: string) => {
  const content = `
    <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #1c1917; font-size: 26px; margin-top: 0; margin-bottom: 24px; font-weight: 500; letter-spacing: -0.01em;">Reset Your Password</h1>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">Hello ${firstName},</p>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">We received a request to reset the password for your Yorkshire Businesswoman account. Click the button below to create a new password.</p>
    
    <!-- BUTTON -->
    <table cellPadding="0" cellSpacing="0" style="margin: 24px 0;">
      <tbody>
        <tr>
          <td>
            <a href="${resetLink}" style="display: inline-block; background-color: #b5604a; color: #fffefb; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 500; padding: 14px 28px; border-radius: 6px; text-decoration: none;">Reset Password →</a>
          </td>
        </tr>
      </tbody>
    </table>

    <div style="background-color: #f8f6f2; border-left: 4px solid #b5604a; padding: 20px 24px; margin: 24px 0; border-radius: 0 6px 6px 0;">
      <p style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #78716c; margin: 0; line-height: 1.6;">
        <strong style="color: #1c1917;">This link expires soon.</strong> If you didn't request a password reset, you can safely ignore this email — your account remains secure.
      </p>
    </div>

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">For security reasons, this link can only be used once. If you need another reset link, please visit our website and request a new one.</p>

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 32px; line-height: 1.6;">
      Stay safe,<br>
      <strong style="color: #1c1917;">The Yorkshire Businesswoman Team</strong>
    </p>
  `;
  return getEmailLayout('Reset Your Password', content);
};

export const getMembershipExpiringEmailTemplate = (firstName: string, membershipTier: string, expiryDate: string, renewalAmount: string) => {
  const content = `
    <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #1c1917; font-size: 26px; margin-top: 0; margin-bottom: 24px; font-weight: 500; letter-spacing: -0.01em;">We'll Miss You</h1>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">Dear ${firstName},</p>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 24px; line-height: 1.6;">We noticed your Yorkshire Businesswoman membership is coming to an end. Before it expires, we wanted to reach out personally — we'd hate to see you go.</p>

    <div style="margin-bottom: 16px;">
      <p style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; margin: 0 0 4px 0;"><span style="color: #a8a29e; display: inline-block; width: 120px;">Membership:</span> <strong style="color: #1c1917;">${membershipTier}</strong></p>
      <p style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; margin: 0;"><span style="color: #a8a29e; display: inline-block; width: 120px;">Expires On:</span> <strong style="color: #1c1917;">${expiryDate}</strong></p>
    </div>

    <div style="background-color: #f8f6f2; border-left: 4px solid #b5604a; padding: 20px 24px; margin: 24px 0; border-radius: 0 6px 6px 0;">
      <p style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #78716c; margin: 0 0 12px 0; line-height: 1.6;">
        <strong style="color: #1c1917;">What you'll lose access to:</strong>
      </p>
      <ul style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #78716c; margin: 0; padding-left: 20px; line-height: 1.8;">
        <li>Exclusive resource library with templates and guides</li>
        <li>Private community forum and networking</li>
        <li>Member-only events and workshops</li>
        <li>Monthly masterclasses and Q&A sessions</li>
      </ul>
    </div>

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">Renew today for just <strong style="color: #1c1917;">£${renewalAmount}</strong> and continue your journey with hundreds of like-minded businesswomen across Yorkshire.</p>

    <!-- BUTTON -->
    <table cellPadding="0" cellSpacing="0" style="margin: 24px 0;">
      <tbody>
        <tr>
          <td>
            <a href="https://yorkshirebusinesswoman.co.uk/renew" style="display: inline-block; background-color: #b5604a; color: #fffefb; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 500; padding: 14px 28px; border-radius: 6px; text-decoration: none;">Renew Membership →</a>
          </td>
        </tr>
      </tbody>
    </table>

    <hr style="border: none; border-top: 1px solid #e5e2db; margin: 24px 0;" />

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">If there's anything we can do to improve your experience or if you have feedback to share, we'd genuinely love to hear from you. Simply reply to this email.</p>

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 32px; line-height: 1.6;">
      Whatever you decide, thank you for being part of our community.<br>
      <strong style="color: #1c1917;">The Yorkshire Businesswoman Team</strong>
    </p>
  `;
  return getEmailLayout('Your Membership is Expiring', content);
};

export const getRenewalReminderEmailTemplate = (firstName: string, membershipTier: string, renewalDate: string, amount: string, daysRemaining: number) => {
  const content = `
    <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #1c1917; font-size: 26px; margin-top: 0; margin-bottom: 24px; font-weight: 500; letter-spacing: -0.01em;">Membership Renewal Reminder</h1>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">Dear ${firstName},</p>
    
    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 24px; line-height: 1.6;">This is a friendly reminder that your Yorkshire Businesswoman membership will automatically renew in <strong style="color: #1c1917;">${daysRemaining} days</strong>. We wanted to give you advance notice so there are no surprises.</p>

    <div style="margin-bottom: 16px;">
      <p style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; margin: 0 0 4px 0;"><span style="color: #a8a29e; display: inline-block; width: 120px;">Membership:</span> <strong style="color: #1c1917;">${membershipTier}</strong></p>
      <p style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; margin: 0 0 4px 0;"><span style="color: #a8a29e; display: inline-block; width: 120px;">Renewal Date:</span> <strong style="color: #1c1917;">${renewalDate}</strong></p>
      <p style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; margin: 0;"><span style="color: #a8a29e; display: inline-block; width: 120px;">Amount:</span> <strong style="color: #1c1917;">£${amount}</strong></p>
    </div>

    <div style="background-color: #f8f6f2; border-left: 4px solid #b5604a; padding: 20px 24px; margin: 24px 0; border-radius: 0 6px 6px 0;">
      <p style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #78716c; margin: 0; line-height: 1.6;">
        <strong style="color: #1c1917;">No action required.</strong> Your membership will renew automatically using your saved payment method. If you need to update your payment details, please do so before the renewal date.
      </p>
    </div>

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">As a member, you've unlocked exclusive benefits including our resource library, networking events, and the private community forum. We're so glad to have you with us.</p>

    <!-- BUTTONS -->
    <table cellPadding="0" cellSpacing="0" width="100%" style="margin: 24px 0;">
      <tbody>
        <tr>
          <td style="padding-right: 8px;">
            <a href="https://yorkshirebusinesswoman.co.uk/billing" style="display: inline-block; background-color: #b5604a; color: #fffefb; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 500; padding: 14px 24px; border-radius: 6px; text-decoration: none;">Update Payment →</a>
          </td>
          <td>
            <a href="https://yorkshirebusinesswoman.co.uk/membership" style="display: inline-block; background-color: #fffefb; color: #1c1917; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 500; padding: 14px 24px; border-radius: 6px; text-decoration: none; border: 1px solid #e5e2db;">View Benefits</a>
          </td>
        </tr>
      </tbody>
    </table>

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 16px; line-height: 1.6;">If you have any questions or wish to make changes to your membership, please contact us before the renewal date.</p>

    <p style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #78716c; margin-top: 0; margin-bottom: 32px; line-height: 1.6;">
      Warm regards,<br>
      <strong style="color: #1c1917;">The Yorkshire Businesswoman Team</strong>
    </p>
  `;
  return getEmailLayout('Membership Renewal Reminder', content);
};
