"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, TrendingUp, Calendar, MessageSquare, Building, MapPin } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore"

interface AnalyticsData {
  membersByMonth: { month: string; count: number }[]
  membersByTier: { tier: string; count: number }[]
  membersByIndustry: { industry: string; count: number }[]
  membersByLocation: { location: string; count: number }[]
  eventAttendance: { event: string; attendees: number; capacity: number }[]
  totalMembers: number
  totalEvents: number
  totalMessages: number
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({
    membersByMonth: [],
    membersByTier: [],
    membersByIndustry: [],
    membersByLocation: [],
    eventAttendance: [],
    totalMembers: 0,
    totalEvents: 0,
    totalMessages: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      // Fetch all members
      const membersRef = collection(db, "users")
      const membersSnap = await getDocs(membersRef)
      const members = membersSnap.docs.map((doc) => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toMillis?.() || Date.now(),
      }))

      // Members by month (last 6 months)
      const monthlyData: Record<string, number> = {}
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
        monthlyData[key] = 0
      }
      members.forEach((m) => {
        const d = new Date(m.createdAt)
        const key = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
        if (key in monthlyData) {
          monthlyData[key]++
        }
      })
      const membersByMonth = Object.entries(monthlyData).map(([month, count]) => ({
        month,
        count,
      }))

      // Members by tier
      const tierCounts: Record<string, number> = { free: 0, premium: 0, professional: 0 }
      members.forEach((m) => {
        const tier = m.membershipTier || "free"
        tierCounts[tier] = (tierCounts[tier] || 0) + 1
      })
      const membersByTier = Object.entries(tierCounts).map(([tier, count]) => ({
        tier: tier.charAt(0).toUpperCase() + tier.slice(1),
        count,
      }))

      // Members by industry (top 6)
      const industryCounts: Record<string, number> = {}
      members.forEach((m) => {
        if (m.industry) {
          industryCounts[m.industry] = (industryCounts[m.industry] || 0) + 1
        }
      })
      const membersByIndustry = Object.entries(industryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([industry, count]) => ({ industry, count }))

      // Members by location (top 6)
      const locationCounts: Record<string, number> = {}
      members.forEach((m) => {
        if (m.location) {
          locationCounts[m.location] = (locationCounts[m.location] || 0) + 1
        }
      })
      const membersByLocation = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([location, count]) => ({ location, count }))

      // Fetch events
      const eventsRef = collection(db, "events")
      const eventsSnap = await getDocs(eventsRef)
      const events = eventsSnap.docs.map((doc) => doc.data())
      const eventAttendance = events
        .slice(0, 5)
        .map((e) => ({
          event: e.title?.slice(0, 25) + (e.title?.length > 25 ? "..." : "") || "Untitled",
          attendees: e.attendees?.length || 0,
          capacity: e.capacity || 50,
        }))

      // Fetch message threads
      const threadsRef = collection(db, "messageThreads")
      const threadsSnap = await getDocs(threadsRef)

      setData({
        membersByMonth,
        membersByTier,
        membersByIndustry,
        membersByLocation,
        eventAttendance,
        totalMembers: members.length,
        totalEvents: events.length,
        totalMessages: threadsSnap.size,
      })
    } catch (error) {
      console.error("Failed to fetch analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const maxMonthlyCount = Math.max(...data.membersByMonth.map((d) => d.count), 1)
  const maxIndustryCount = Math.max(...data.membersByIndustry.map((d) => d.count), 1)

  const tierColors: Record<string, string> = {
    Free: "bg-muted",
    Premium: "bg-accent",
    Professional: "bg-amber-500",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Insights into your community
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Members
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : data.totalMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : data.totalEvents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversations
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : data.totalMessages}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList>
          <TabsTrigger value="growth">Member Growth</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Member Growth</CardTitle>
              <CardDescription>New members over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-2 h-[200px]">
                    {data.membersByMonth.map((item) => (
                      <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                        <div
                          className="w-full bg-accent rounded-t transition-all"
                          style={{
                            height: `${(item.count / maxMonthlyCount) * 160}px`,
                            minHeight: item.count > 0 ? "8px" : "2px",
                          }}
                        />
                        <span className="text-xs text-muted-foreground">{item.month}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center gap-8 text-sm">
                    {data.membersByMonth.map((item) => (
                      <span key={item.month} className="text-muted-foreground">
                        {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* By Tier */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Membership Tiers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                    Loading...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.membersByTier.map((item) => (
                      <div key={item.tier} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{item.tier}</span>
                          <span className="text-muted-foreground">{item.count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${tierColors[item.tier] || "bg-accent"}`}
                            style={{
                              width: `${(item.count / data.totalMembers) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Industry */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Top Industries
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                    Loading...
                  </div>
                ) : data.membersByIndustry.length === 0 ? (
                  <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                    No industry data yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.membersByIndustry.map((item, idx) => (
                      <div key={item.industry} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="truncate">{item.industry}</span>
                            <span className="text-muted-foreground shrink-0">{item.count}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{
                                width: `${(item.count / maxIndustryCount) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Location */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Member Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[100px] flex items-center justify-center text-muted-foreground">
                    Loading...
                  </div>
                ) : data.membersByLocation.length === 0 ? (
                  <div className="h-[100px] flex items-center justify-center text-muted-foreground">
                    No location data yet
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.membersByLocation.map((item) => (
                      <div
                        key={item.location}
                        className="bg-muted px-3 py-2 rounded-lg"
                      >
                        <span className="font-medium">{item.location}</span>
                        <span className="text-muted-foreground ml-2">({item.count})</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Event Attendance</CardTitle>
              <CardDescription>Recent event capacity vs attendance</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Loading...
                </div>
              ) : data.eventAttendance.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No events yet
                </div>
              ) : (
                <div className="space-y-4">
                  {data.eventAttendance.map((event) => (
                    <div key={event.event} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{event.event}</span>
                        <span className="text-muted-foreground shrink-0">
                          {event.attendees} / {event.capacity}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{
                            width: `${(event.attendees / event.capacity) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
