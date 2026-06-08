"use client";
import { useState, useEffect } from "react";
 import Link from"next/link";
import { Users, Calendar, TrendingUp, ArrowUpRight, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminOverviewStats } from "@/app/actions/adminOverviewActions";

interface Stats {
  totalMembers: number
  newMembersThisMonth: number
  memberGrowth: number
  totalEvents: number
  upcomingEvents: number
  totalMessages: number
  ghostMembers: number
  beehiivMembers?: number
}

interface RecentMember {
  id: string
  firstName: string
  lastName: string
  email: string
  createdAt: number
  membershipTier: string
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    newMembersThisMonth: 0,
    memberGrowth: 0,
    totalEvents: 0,
    upcomingEvents: 0,
    totalMessages: 0,
    ghostMembers: 0,
  })
  const [recentMembers, setRecentMembers] = useState<RecentMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      const result = await getAdminOverviewStats()
      if (result.success && result.data) {
        setStats(result.data)
        setRecentMembers(result.data.recentMembers || [])
      } else {
        setError(result.error || "Failed to load dashboard data")
      }
      setLoading(false)
    }
    fetchStats()
  }, [])

  const statCards = [
    {
      title: "Total Members",
      value: stats.totalMembers,
      change: `+${stats.newMembersThisMonth} this month`,
      trend: "up",
      icon: Users,
      href: "/admin/members",
    },
    {
      title: "Upcoming Events",
      value: stats.upcomingEvents,
      change: `${stats.totalEvents} total`,
      trend: "neutral",
      icon: Calendar,
      href: "/admin/members",
    },
    {
      title: "Member Growth",
      value: `${stats.memberGrowth}%`,
      change: "This month",
      trend: stats.memberGrowth > 0 ? "up" : "down",
      icon: TrendingUp,
      href: "/admin/analytics",
    },
    {
      title: "Newsletter Reach",
      value: (stats.ghostMembers || 0) + (stats.beehiivMembers || 0),
      change: `${stats.beehiivMembers || 0} on Beehiiv`,
      trend: "neutral",
      icon: Users,
      href: "/admin/newsletter",
    },
  ]

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-muted-foreground">Gathering community insights...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <p className="text-destructive font-medium">Error loading dashboard</p>
        <p className="text-muted-foreground text-sm max-w-md">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="mt-4">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-medium text-foreground">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to the Yorkshire Businesswoman admin panel
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <div className="bg-card border border-border p-6 hover:border-accent/30 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {stat.title}
                </p>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="font-serif text-3xl font-medium text-foreground">
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                {stat.trend === "up" && <ArrowUpRight className="h-3 w-3 text-accent" />}
                {stat.change}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Members */}
      <div className="bg-card border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-serif text-xl font-medium text-foreground">Recent Members</h2>
            <p className="text-sm text-muted-foreground mt-1">Newest members to join the community</p>
          </div>
          <Link 
            href="/admin/members" 
            className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="p-6">
          {recentMembers.length === 0 ? (
            <p className="text-muted-foreground">No members yet</p>
          ) : (
            <div className="space-y-4">
              {recentMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-foreground">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-wider text-accent">
                      {member.membershipTier}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(member.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
