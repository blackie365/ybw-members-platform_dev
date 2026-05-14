import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication | Yorkshire Businesswoman',
  description: 'Manage your authentication',
};

export default function AuthActionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
