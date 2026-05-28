import * as React from "react"
import {
  EmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailInfoCard,
  EmailDivider,
} from "./email-layout"

interface PaymentReceiptEmailProps {
  firstName: string
  invoiceNumber: string
  paymentDate: string
  membershipTier: string
  amount: string
  billingPeriod: string
  paymentMethod: string
}

export function PaymentReceiptEmail({
  firstName,
  invoiceNumber,
  paymentDate,
  membershipTier,
  amount,
  billingPeriod,
  paymentMethod,
}: PaymentReceiptEmailProps) {
  return (
    <EmailLayout previewText={`Payment receipt for your ${membershipTier} membership - £${amount}`}>
      <EmailHeading>Payment Confirmed</EmailHeading>
      
      <EmailText>
        Dear {firstName},
      </EmailText>
      
      <EmailText>
        Thank you for your payment. This email confirms that your membership payment has been 
        successfully processed. Please keep this receipt for your records.
      </EmailText>

      <EmailDivider />

      <EmailInfoCard label="Invoice Number" value={invoiceNumber} />
      <EmailInfoCard label="Payment Date" value={paymentDate} />
      <EmailInfoCard label="Membership" value={membershipTier} />
      <EmailInfoCard label="Billing Period" value={billingPeriod} />
      <EmailInfoCard label="Payment Method" value={paymentMethod} />

      <div
        style={{
          backgroundColor: "#242220",
          padding: "20px 24px",
          borderRadius: "6px",
          marginTop: "16px",
        }}
      >
        <table cellPadding="0" cellSpacing="0" width="100%">
          <tbody>
            <tr>
              <td>
                <p
                  style={{
                    fontFamily: "'Inter', Arial, sans-serif",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#f8f6f2",
                    margin: 0,
                  }}
                >
                  Total Paid
                </p>
              </td>
              <td style={{ textAlign: "right" }}>
                <p
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: "24px",
                    fontWeight: 500,
                    color: "#f8f6f2",
                    margin: 0,
                  }}
                >
                  £{amount}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <EmailDivider />

      <EmailText>
        Need a copy of your invoice? You can download it from your account dashboard at any time.
      </EmailText>

      <EmailButton href="https://yorkshirebusinesswoman.co.uk/billing">
        View Billing History →
      </EmailButton>

      <EmailText>
        If you have any questions about this payment, please don&apos;t hesitate to contact us.
      </EmailText>

      <EmailText>
        Thank you for being a valued member,<br />
        <strong style={{ color: "#1c1917" }}>The Yorkshire Businesswoman Team</strong>
      </EmailText>
    </EmailLayout>
  )
}
