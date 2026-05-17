import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WelcomeEmail } from '@/components/emails/welcome-email';
import { PasswordResetEmail } from '@/components/emails/password-reset-email';
import { MembershipExpiringEmail } from '@/components/emails/membership-expiring-email';
import { RenewalReminderEmail } from '@/components/emails/renewal-reminder-email';
import { EventInvitationEmail } from '@/components/emails/event-invitation-email';
import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailHighlightBox,
} from '@/components/emails/email-layout';

// Helper to render React components to HTML
function renderEmail(Component: React.ReactElement) {
  return `<!DOCTYPE html>${renderToStaticMarkup(Component)}`;
}

export const getWelcomeEmailTemplate = (firstName: string, appUrl: string) => {
  return renderEmail(
    <WelcomeEmail firstName={firstName} membershipTier="Premium Member" />
  );
};

export const getFreeWelcomeEmailTemplate = (firstName: string, appUrl: string) => {
  return renderEmail(
    <WelcomeEmail firstName={firstName} membershipTier="Free Subscriber" />
  );
};

export const getEventTicketConfirmationEmailTemplate = (firstName: string, appUrl: string) => {
  return renderEmail(
    <EmailLayout previewText={`You're going to the event, ${firstName}!`}>
      <EmailHeading>You're going to the event!</EmailHeading>
      <EmailText>Hi {firstName},</EmailText>
      <EmailText>This email confirms your successful ticket purchase and RSVP.</EmailText>
      <EmailText>Your name has been automatically added to the guest list. You can view the event details and see who else is attending by visiting the event page on the Yorkshire Businesswoman platform.</EmailText>
      <EmailButton href={`${appUrl}/events`}>View Event Details →</EmailButton>
      <EmailText>We look forward to seeing you there!</EmailText>
    </EmailLayout>
  );
};

export const getPasswordResetEmailTemplate = (firstName: string, resetLink: string) => {
  return renderEmail(
    <PasswordResetEmail firstName={firstName} resetLink={resetLink} expiryHours={24} />
  );
};

export const getMembershipExpiringEmailTemplate = (firstName: string, membershipTier: string, expiryDate: string, renewalAmount: string) => {
  return renderEmail(
    <MembershipExpiringEmail 
      firstName={firstName} 
      membershipTier={membershipTier} 
      expiryDate={expiryDate} 
      renewalAmount={renewalAmount} 
    />
  );
};

export const getRenewalReminderEmailTemplate = (firstName: string, membershipTier: string, renewalDate: string, amount: string, daysRemaining: number) => {
  return renderEmail(
    <RenewalReminderEmail 
      firstName={firstName} 
      membershipTier={membershipTier} 
      renewalDate={renewalDate} 
      amount={amount} 
      daysRemaining={daysRemaining} 
    />
  );
};
