import * as React from 'react';
import { render } from '@react-email/render';
import { WelcomeEmail } from '@/components/emails/welcome-email';
import { PasswordResetEmail } from '@/components/emails/password-reset-email';
import { MembershipExpiringEmail } from '@/components/emails/membership-expiring-email';
import { RenewalReminderEmail } from '@/components/emails/renewal-reminder-email';
import { EventInvitationEmail } from '@/components/emails/event-invitation-email';
import { PaymentReceiptEmail } from '@/components/emails/payment-receipt-email';
import { AccountUpdateEmail } from '@/components/emails/account-update-email';
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
    <EmailLayout previewText={`You&apos;re going to the event, ${firstName}!`}>
      <EmailHeading>You&apos;re going to the event!</EmailHeading>
      <EmailText>Hi {firstName},</EmailText>
      <EmailText>This email confirms your successful ticket purchase and RSVP.</EmailText>
      <EmailText>Your name has been automatically added to the guest list. You can view the event details and see who else is attending by visiting the event page on the Yorkshire Businesswoman platform.</EmailText>
      <EmailButton href={`${appUrl}/events`}>View Event Details →</EmailButton>
      <EmailText>We look forward to seeing you there!</EmailText>
    </EmailLayout>
  );
};

export const getPasswordResetEmailTemplate = async (firstName: string, resetLink: string) => {
  return await renderEmail(
    <PasswordResetEmail 
      firstName={firstName} 
      resetLink={resetLink} 
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

export const getPaymentReceiptEmailTemplate = async (firstName: string, invoiceNumber: string, paymentDate: string, membershipTier: string, amount: string, billingPeriod: string, paymentMethod: string) => {
  return await renderEmail(
    <PaymentReceiptEmail 
      firstName={firstName}
      invoiceNumber={invoiceNumber}
      paymentDate={paymentDate}
      membershipTier={membershipTier}
      amount={amount}
      billingPeriod={billingPeriod}
      paymentMethod={paymentMethod}
    />
  );
};

export const getAccountUpdateEmailTemplate = async (firstName: string, updateType: "email" | "password" | "payment" | "profile", updateDate: string, updateTime: string) => {
  return await renderEmail(
    <AccountUpdateEmail 
      firstName={firstName}
      updateType={updateType}
      updateDate={updateDate}
      updateTime={updateTime}
    />
  );
};

import { DailyNewsEmail } from '@/components/emails/daily-news-email';

export const getDailyNewsletterTemplate = async (stories: any[], recipientName?: string, editorNote?: string, date?: Date, hideFooter?: boolean) => {
  return await renderEmail(
    <DailyNewsEmail stories={stories} recipientName={recipientName} editorNote={editorNote} date={date} hideFooter={hideFooter} />
  );
};
