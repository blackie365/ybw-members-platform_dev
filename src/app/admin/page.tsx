"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, MessageSquare, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"
import Link from "next/link"
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
  displayName: string
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
      // Fetch members
      const membersRef = collection(db, "users")
      const membersSnap = await getDocs(membersRef)
      const totalMembers = membersSnap.size

      // Calculate new members this month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const newMembersQuery = query(
        membersRef,
        where("createdAt", ">=", Timestamp.fromDate(startOfMonth))
      )
      const newMembersSnap = await getDocs(newMembersQuery)
      const newMembersThisMonth = newMembersSnap.size

      // Fetch recent members
      const recentQuery = query(membersRef, orderBy("createdAt", "desc"), limit(5))
      const recentSnap = await getDocs(recentQuery)
      const recent = recentSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toMillis?.() || Date.now(),
      })) as RecentMember[]
      setRecentMembers(recent)

      // Fetch events
      const eventsRef = collection(db, "events")
      const eventsSnap = await getDocs(eventsRef)
      const totalEvents = eventsSnap.size

      const upcomingQuery = query(
        eventsRef,
        where("date", ">=", Timestamp.fromDate(new Date()))
      )
      const upcomingSnap = await getDocs(upcomingQuery)
      const upcomingEvents = upcomingSnap.size

      // Fetch messages
      const threadsRef = collection(db, "messageThreads")
      const threadsSnap = await getDocs(threadsRef)
      const activeThreads = threadsSnap.size

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
        <h1 className="font-serif text-3xl font-bold text-foreground">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to the Yorkshire Businesswoman admin panel
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:border-accent/30 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {stat.trend === "up" && <ArrowUpRight className="h-3 w-3 text-green-600" />}
                  {stat.trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-600" />}
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Members</CardTitle>
              <CardDescription>Newest members to join the community</CardDescription>
            </div>
            <Link 
              href="/admin/members" 
              className="text-sm text-accent hover:underline"
            >
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : recentMembers.length === 0 ? (
            <p className="text-muted-foreground">No members yet</p>
          ) : (
            <div className="space-y-4">
              {recentMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{member.displayName || "No name"}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm capitalize">{member.membershipTier || "Free"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
