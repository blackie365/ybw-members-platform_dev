'use client';

import Link from "next/link";
import { ChevronLeft, Shield } from "lucide-react";

interface AdminHeaderProps {
  userName?: string;
}

export function AdminHeader({ userName }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-foreground text-background border-b">
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-background/70 hover:text-background transition-colors">
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm">Back to Site</span>
          </Link>
          <div className="h-6 w-px bg-background/20" />
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            <span className="font-serif font-bold">Admin Panel</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-background/70">{userName || ""}</span>
        </div>
      </div>
    </header>
  );
}
