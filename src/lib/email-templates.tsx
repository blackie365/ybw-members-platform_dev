import * as React from 'react';
import { render } from '@react-email/components';
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
} from '@/components/emails/email-layout';

// Helper to safely render React components to HTML avoiding Next.js edge-runtime conflicts
async function renderEmail(Component: React.ReactElement) {
  return await render(Component);
}

export const getWelcomeEmailTemplate = async (firstName: string, appUrl: string) => {
  return await renderEmail(
    <WelcomeEmail firstName={firstName} membershipTier="Premium Member" />
  );
};

export const getFreeWelcomeEmailTemplate = async (firstName: string, appUrl: string) => {
  return await renderEmail(
    <WelcomeEmail firstName={firstName} membershipTier="Free Subscriber" />
  );
};

export const getEventTicketConfirmationEmailTemplate = async (firstName: string, appUrl: string) => {
  return await renderEmail(
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

export const getPasswordResetEmailTemplate = async (firstName: string) => {
  return await renderEmail(
    <PasswordResetEmail 
      firstName={firstName} 
      resetLink="https://yorkshirebusinesswoman.co.uk/forgot-password" 
    />
  );
};

export const getMembershipExpiringEmailTemplate = async (firstName: string, membershipTier: string, expiryDate: string, renewalAmount: string) => {
  return await renderEmail(
    <MembershipExpiringEmail 
      firstName={firstName} 
      membershipTier={membershipTier} 
      expiryDate={expiryDate} 
      renewalAmount={renewalAmount} 
    />
  );
};

export const getRenewalReminderEmailTemplate = async (firstName: string, membershipTier: string, renewalDate: string, amount: string, daysRemaining: number) => {
  return await renderEmail(
    <RenewalReminderEmail 
      firstName={firstName} 
      membershipTier={membershipTier} 
      renewalDate={renewalDate} 
      amount={amount} 
      daysRemaining={daysRemaining} 
    />
  );
};

import { DailyNewsEmail } from '@/components/emails/daily-news-email';

export const getDailyNewsletterTemplate = async (stories: any[], recipientName?: string, editorNote?: string) => {
  return await renderEmail(
    <DailyNewsEmail stories={stories} recipientName={recipientName} editorNote={editorNote} />
  );
};
