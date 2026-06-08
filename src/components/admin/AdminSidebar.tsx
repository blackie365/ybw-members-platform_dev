'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Mail,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/magazine", label: "Editorial Studio", icon: BookOpen },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-[calc(100vh-4rem)] bg-background border-r shrink-0 hidden md:block">
      <nav className="p-4 space-y-1">
        {adminNavItems?.map((item) => {
          const isActive = pathname === item?.href || 
            (item?.href !== "/admin" && pathname?.startsWith(item?.href));
          return (
            <Link
              key={item?.href}
              href={item?.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-accent/10 text-accent" :"text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4", isActive ? "text-accent" : "text-muted-foreground")} />
              {item?.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
