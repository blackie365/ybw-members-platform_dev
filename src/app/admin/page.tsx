"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, MessageSquare, TrendingUp, ArrowUpRight, ArrowDownRight, Newspaper, Mail, Tag } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/firebase"
import { collection, query, getDocs, where, orderBy, limit, Timestamp } from "firebase/firestore"
import { getAdminStats } from "../actions/adminActions"

interface Stats {
  totalMembers: number
  newMembersThisMonth: number
  memberGrowth: number
  activeThreads: number
  totalPosts: number
  totalGhostMembers: number
  totalTags: number
}

interface RecentMember {
  id: string
  displayName: string
  email: string
  createdAt: string | number
  membershipTier: string
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    newMembersThisMonth: 0,
    memberGrowth: 0,
    activeThreads: 0,
    totalPosts: 0,
    totalGhostMembers: 0,
    totalTags: 0,
  })
  const [recentMembers, setRecentMembers] = useState<RecentMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // 1. Fetch Stats from Server Action (Combined Firebase + Ghost)
      const result = await getAdminStats()
      if (result.success && result.stats) {
        setStats(result.stats as Stats)
      }

      // 2. Fetch recent members from client (keeping it fast for UI)
      const membersRef = collection(db, "newMemberCollection")
      const recentQuery = query(membersRef, orderBy("createdAt", "desc"), limit(5))
      const recentSnap = await getDocs(recentQuery)
      const recent = recentSnap.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt || Date.now(),
        }
      }) as RecentMember[]
      setRecentMembers(recent)

    } catch (error) {
      console.error("Failed to fetch admin data:", error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: "App Members",
      value: stats.totalMembers,
      change: `+${stats.newMembersThisMonth} this month`,
      trend: "up",
      icon: Users,
      href: "/admin/members",
    },
    {
      title: "Newsletter Subs",
      value: stats.totalGhostMembers,
      change: "From Ghost",
      trend: "neutral",
      icon: Mail,
      href: "https://admin.yorkshirebusinesswoman.co.uk",
    },
    {
      title: "Magazine Posts",
      value: stats.totalPosts,
      change: "Total articles",
      trend: "neutral",
      icon: Newspaper,
      href: "https://admin.yorkshirebusinesswoman.co.uk",
    },
    {
      title: "Active Chats",
      value: stats.activeThreads,
      change: "Member connections",
      trend: "neutral",
      icon: MessageSquare,
      href: "/admin/analytics",
    },
  ]

  const formatDate = (dateValue: string | number) => {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : new Date(dateValue)
    return date.toLocaleDateString("en-GB", {
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
