"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users, Calendar, MessageSquare, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOverviewStats } from "@/app/actions/adminActions";

type OverviewStats = {
  totalMembers: number;
  newMembersThisMonth: number;
  memberGrowth: number;
  totalEvents: number;
  upcomingEvents: number;
  totalMessages: number;
  ghostMembers: number;
  beehiivMembers: number;
  recentMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: number;
    membershipTier: string;
  }>;
  lastUpdated: string;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAdminOverviewStats();
        if (res.success) {
          setStats(res.data as OverviewStats);
        } else {
          setError(res.error || "Failed to load overview");
        }
      } catch (e: any) {
        setError(String(e?.message || e || "Failed to load overview"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-muted-foreground">Loading overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1">Admin dashboard status</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Unable to load overview</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Link className="text-accent hover:underline" href="/admin/members">Members</Link>
            <Link className="text-accent hover:underline" href="/admin/ads">Ads</Link>
            <Link className="text-accent hover:underline" href="/admin/analytics">Analytics</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1">Quick snapshot of members and engagement</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-accent/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Members</CardTitle>
            <Users className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.newMembersThisMonth} new this month</p>
          </CardContent>
        </Card>

        <Card className="border-accent/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{stats.memberGrowth}%</div>
            <p className="text-xs text-muted-foreground mt-1">New vs total</p>
          </CardContent>
        </Card>

        <Card className="border-accent/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Events</CardTitle>
            <Calendar className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.upcomingEvents} upcoming</p>
          </CardContent>
        </Card>

        <Card className="border-accent/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground mt-1">Threads</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Quick Links</CardTitle>
          <CardDescription>Go straight to the tools</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Link className="text-accent hover:underline" href="/admin/members">Members</Link>
          <Link className="text-accent hover:underline" href="/admin/ads">Ads</Link>
          <Link className="text-accent hover:underline" href="/admin/magazine">Magazine</Link>
          <Link className="text-accent hover:underline" href="/admin/newsletter">Newsletter</Link>
          <Link className="text-accent hover:underline" href="/admin/analytics">Analytics</Link>
          <Link className="text-accent hover:underline" href="/admin/webstats">Web Stats</Link>
        </CardContent>
      </Card>
    </div>
  );
}
