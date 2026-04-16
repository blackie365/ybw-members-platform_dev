import { redirect } from 'next/navigation';

export default function DashboardDirectory() {
  // Just redirect to the main members directory page
  redirect('/members');
}