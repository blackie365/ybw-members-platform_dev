"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, Calendar, MessageSquare, TrendingUp, ArrowUpRight, ArrowRight } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, query, getDocs, where, orderBy, limit, Timestamp } from "firebase/firestore"

interface Stats {
  totalMembers: number
  newMembersThisMonth: number
  memberGrowth: number
  totalEvents: number
  upcomingEvents: number
  totalMessages: number
  activeThreads: number
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
    activeThreads: 0,
  })
  const [recentMembers, setRecentMembers] = useState<RecentMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      if (!db) {
        setLoading(false)
        return
      }

      const membersRef = collection(db, "newMemberCollection")
      const membersSnap = await getDocs(membersRef)
      const totalMembers = membersSnap.size

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      let newMembersThisMonth = 0
      const recent: RecentMember[] = []
      
      membersSnap.docs.forEach((doc) => {
        const data = doc.data()
        const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : Date.now()
        
        if (createdAt >= startOfMonth.getTime()) {
          newMembersThisMonth++
        }
        
        recent.push({
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          createdAt,
          membershipTier: data.membershipTier || 'free',
        })
      })

      recent.sort((a, b) => b.createdAt - a.createdAt)
      setRecentMembers(recent.slice(0, 5))

      let totalEvents = 0
      let upcomingEvents = 0
      let activeThreads = 0

      try {
        const eventsRef = collection(db, "events")
        const eventsSnap = await getDocs(eventsRef)
        totalEvents = eventsSnap.size

        eventsSnap.docs.forEach((doc) => {
          const data = doc.data()
          if (data.startDate && new Date(data.startDate) >= new Date()) {
            upcomingEvents++
          }
        })
      } catch (e) {
        console.warn("Events collection may not exist yet")
      }

      try {
        const threadsRef = collection(db, "messageThreads")
        const threadsSnap = await getDocs(threadsRef)
        activeThreads = threadsSnap.size
      } catch (e) {
        console.warn("MessageThreads collection may not exist yet")
      }

      setStats({
        totalMembers,
        newMembersThisMonth,
        memberGrowth: totalMembers > 0 ? Math.round((newMembersThisMonth / totalMembers) * 100) : 0,
        totalEvents,
        upcomingEvents,
        totalMessages: 0,
        activeThreads,
      })
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setLoading(false)
    }
  }

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
      href: "/admin/events",
    },
    {
      title: "Active Conversations",
      value: stats.activeThreads,
      change: "Member connections",
      trend: "neutral",
      icon: MessageSquare,
      href: "/admin/analytics",
    },
    {
      title: "Member Growth",
      value: `${stats.memberGrowth}%`,
      change: "This month",
      trend: stats.memberGrowth > 0 ? "up" : "down",
      icon: TrendingUp,
      href: "/admin/analytics",
    },
  ]

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
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
                {loading ? "..." : stat.value}
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
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : recentMembers.length === 0 ? (
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
