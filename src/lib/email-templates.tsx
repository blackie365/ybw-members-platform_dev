import * as React from 'react';
import { render } from '@react-email/render';
import { config } from '@/lib/config';
import { WelcomeEmail } from '@/components/emails/welcome-email';
import { PasswordResetEmail } from '@/components/emails/password-reset-email';
import { MembershipExpiringEmail } from '@/components/emails/membership-expiring-email';
import { RenewalReminderEmail } from '@/components/emails/renewal-reminder-email';
import { PaymentReceiptEmail } from '@/components/emails/payment-receipt-email';
import { AccountUpdateEmail } from '@/components/emails/account-update-email';
import { NewsletterWelcomeEmail } from '@/components/emails/newsletter-welcome-email';
import { DailyNewsEmail } from '@/components/emails/daily-news-email';
import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailDivider,
  EmailInfoCard,
} from '@/components/emails/email-layout';

async function renderEmail(Component: React.ReactElement) {
  return render(Component);
}

export const getNewsletterWelcomeEmailTemplate = async (firstName: string) =>
  renderEmail(<NewsletterWelcomeEmail firstName={firstName} />);

export const getWelcomeEmailTemplate = async (firstName: string, _appUrl: string) =>
  renderEmail(<WelcomeEmail firstName={firstName} membershipTier="Premium Member" />);

export const getFreeWelcomeEmailTemplate = async (firstName: string, _appUrl: string) =>
  renderEmail(<WelcomeEmail firstName={firstName} membershipTier="Free Subscriber" />);

export const getEventTicketConfirmationEmailTemplate = async (firstName: string, appUrl: string) => {
  return renderEmail(
    <EmailLayout previewText={`You&apos;re going to the event, ${firstName}!`}>
      <EmailHeading>You&apos;re going to the event!</EmailHeading>
      <EmailText>Hi {firstName},</EmailText>
      <EmailText>This email confirms your successful ticket purchase and RSVP.</EmailText>
      <EmailText>Your name has been automatically added to the guest list. You can view the event details and see who else is attending by visiting the event page on the Yorkshire BusinessWoman platform.</EmailText>
      <EmailButton href={`${appUrl}/events`}>View Event Details →</EmailButton>
      <EmailText>We look forward to seeing you there!</EmailText>
    </EmailLayout>
  );
};

export const getPasswordResetEmailTemplate = async (firstName: string, resetLink: string) =>
  renderEmail(<PasswordResetEmail firstName={firstName} resetLink={resetLink} />);

export const getMembershipExpiringEmailTemplate = async (firstName: string, membershipTier: string, expiryDate: string, renewalAmount: string) =>
  renderEmail(<MembershipExpiringEmail firstName={firstName} membershipTier={membershipTier} expiryDate={expiryDate} renewalAmount={renewalAmount} />);

export const getRenewalReminderEmailTemplate = async (firstName: string, membershipTier: string, renewalDate: string, amount: string, daysRemaining: number) =>
  renderEmail(<RenewalReminderEmail firstName={firstName} membershipTier={membershipTier} renewalDate={renewalDate} amount={amount} daysRemaining={daysRemaining} />);

export const getPaymentReceiptEmailTemplate = async (firstName: string, invoiceNumber: string, paymentDate: string, membershipTier: string, amount: string, billingPeriod: string, paymentMethod: string) =>
  renderEmail(<PaymentReceiptEmail firstName={firstName} invoiceNumber={invoiceNumber} paymentDate={paymentDate} membershipTier={membershipTier} amount={amount} billingPeriod={billingPeriod} paymentMethod={paymentMethod} />);

export const getAccountUpdateEmailTemplate = async (firstName: string, updateType: 'email' | 'password' | 'payment' | 'profile', updateDate: string, updateTime: string) =>
  renderEmail(<AccountUpdateEmail firstName={firstName} updateType={updateType} updateDate={updateDate} updateTime={updateTime} />);

export const getDailyNewsletterTemplate = async (stories: any[], recipientName?: string, editorNote?: string, date?: Date, hideFooter?: boolean) =>
  renderEmail(<DailyNewsEmail stories={stories} recipientName={recipientName} editorNote={editorNote} date={date} hideFooter={hideFooter} />);

export const getNewsletterSignupAlertTemplate = async (email: string, firstName?: string, lastName?: string, source?: string) => {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Not provided';
  const signupTime = new Date().toLocaleString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return renderEmail(
    <EmailLayout previewText={`New newsletter sign-up: ${email}`}>
      <EmailHeading>New Newsletter Sign-Up</EmailHeading>
      <EmailText>A new visitor has subscribed to the Yorkshire BusinessWoman newsletter.</EmailText>
      <EmailDivider />
      <EmailInfoCard label="Email Address" value={email} />
      <EmailInfoCard label="Full Name" value={fullName} />
      <EmailInfoCard label="Sign-up Source" value={source || 'Home Page Pop-up'} />
      <EmailInfoCard label="Sign-up Time" value={signupTime} />
      <EmailDivider />
      <EmailText>This subscriber has been added to:</EmailText>
      <ul style={{
        fontFamily: "'Inter', Arial, sans-serif",
        fontSize: '15px',
        color: '#78716c',
        lineHeight: 1.7,
        paddingLeft: '20px',
        margin: '0 0 16px 0',
      }}>
        <li style={{ marginBottom: '8px' }}>Beehiiv (primary newsletter list)</li>
        <li style={{ marginBottom: '8px' }}>Ghost CMS (newsletter-signup label)</li>
        <li style={{ marginBottom: '8px' }}>Firestore (free tier member record)</li>
      </ul>
      <EmailButton href={`${config.siteUrl}/admin/newsletter`}>View Newsletter Admin</EmailButton>
    </EmailLayout>
  );
};
