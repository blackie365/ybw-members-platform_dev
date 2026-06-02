"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, TrendingUp, Calendar, MessageSquare, Building, MapPin, Loader2, Mail } from "lucide-react"
import { getAnalyticsData, getBeehiivPostStatsAction } from "@/app/actions/adminActions"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from "recharts"

interface AnalyticsData {
  membersByMonth: { name: string; platform: number; ghost: number; total: number }[]
  membersByTier: { name: string; value: number }[]
  ghostStatusData: { name: string; value: number }[]
  platformStatusData: { name: string; value: number }[]
  membersByIndustry: { name: string; value: number }[]
  membersByLocation: { name: string; value: number }[]
  eventAttendance: { name: string; attendees: number; capacity: number }[]
  totalMembers: number
  totalGhostMembers: number
  totalBeehiivMembers?: number
  activeBeehiivMembers?: number
  totalEvents: number
  totalMessages: number
}

const COLORS = ['#b79c65', '#1c1917', '#57534e', '#e7e5e4', '#d4d4d8', '#71717a', '#3f3f46', '#18181b'];

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [beehiivStats, setBeehiivStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingBeehiiv, setLoadingBeehiiv] = useState(false)

  useEffect(() => {
    fetchAnalytics()
    fetchBeehiivStats()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const res = await getAnalyticsData()
      if (res.success && res.data) {
        setData(res.data)
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBeehiivStats = async () => {
    setLoadingBeehiiv(true)
    try {
      const res = await getBeehiivPostStatsAction()
      if (res.success && res.stats) {
        setBeehiivStats(res.stats)
      }
    } catch (error) {
      console.error("Failed to fetch Beehiiv stats:", error)
    } finally {
      setLoadingBeehiiv(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-muted-foreground">Gathering community insights...</p>
      </div>
    )
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Real-time insights into your community growth and engagement
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
        <Card className="border-accent/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Platform
            </CardTitle>
            <Users className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{data.totalMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">Clerk / Firestore</p>
          </CardContent>
        </Card>
        <Card className="border-accent/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Ghost
            </CardTitle>
            <Users className="h-4 w-4 text-[#3eb0ef]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{data.totalGhostMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">CMS Members</p>
          </CardContent>
        </Card>
        <Card className="border-accent/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Beehiiv
            </CardTitle>
            <Mail className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{data.totalBeehiivMembers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Newsletter</p>
          </CardContent>
        </Card>
        <Card className="border-accent/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Total Reach
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">
              {data.totalMembers + data.totalGhostMembers + (data.totalBeehiivMembers || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Combined community</p>
          </CardContent>
        </Card>
        <Card className="border-accent/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Events
            </CardTitle>
            <Calendar className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{data.totalEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">Managed sessions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="growth" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="growth" className="px-6">Growth</TabsTrigger>
          <TabsTrigger value="demographics" className="px-6">Demographics</TabsTrigger>
          <TabsTrigger value="engagement" className="px-6">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="growth">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Community Growth</CardTitle>
              <CardDescription>New member registrations from both Platform and Ghost sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.membersByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#888' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#888' }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8f8f8' }}
                      contentStyle={{ 
                        borderRadius: '8px', 
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Bar 
                      name="Platform"
                      dataKey="platform" 
                      fill="#b79c65" 
                      radius={[4, 4, 0, 0]} 
                      barSize={20}
                    />
                    <Bar 
                      name="Ghost"
                      dataKey="ghost" 
                      fill="#3eb0ef" 
                      radius={[4, 4, 0, 0]} 
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demographics">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Membership Tiers (Platform) */}
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Platform Tiers</CardTitle>
                <CardDescription>Active members by subscription plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.membersByTier}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.membersByTier.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Platform Status (Active vs Inactive) */}
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Platform Status</CardTitle>
                <CardDescription>Total database records (Active vs Inactive)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.platformStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.platformStatusData.map((entry, index) => (
                          <Cell key={`cell-status-${index}`} fill={index === 0 ? '#b79c65' : '#e7e5e4'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Ghost Subscription Status */}
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Ghost Subscriptions</CardTitle>
                <CardDescription>Newsletter subscribers by status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.ghostStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.ghostStatusData.map((entry, index) => (
                          <Cell key={`cell-ghost-${index}`} fill={index === 1 ? '#3eb0ef' : COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Industries */}
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Top Industries</CardTitle>
                <CardDescription>Members grouped by sector</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.membersByIndustry}
                      margin={{ left: 20, right: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false}
                        width={100}
                        tick={{ fontSize: 11, fill: '#666' }}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#1c1917" 
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Locations */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="font-serif">Top Locations</CardTitle>
                <CardDescription>Geographic distribution of members</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4">
                  {data.membersByLocation.map((loc, idx) => (
                    <div key={loc.name} className="flex flex-col items-center p-4 bg-muted/30 rounded-lg">
                      <MapPin className="h-4 w-4 text-accent mb-2" />
                      <span className="text-sm font-medium text-foreground">{loc.name}</span>
                      <span className="text-2xl font-serif font-bold text-accent mt-1">{loc.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Newsletter Performance</CardTitle>
              <CardDescription>Recent campaigns sent via Beehiiv</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBeehiiv ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </div>
              ) : beehiivStats.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No newsletter data available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Campaign</th>
                        <th className="px-4 py-3 font-medium">Sent</th>
                        <th className="px-4 py-3 font-medium">Opens</th>
                        <th className="px-4 py-3 font-medium">Clicks</th>
                        <th className="px-4 py-3 font-medium">Open Rate</th>
                        <th className="px-4 py-3 font-medium">CTR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {beehiivStats.map((stat) => (
                        <tr key={stat.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium max-w-[200px] truncate">{stat.title}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(stat.sent_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">{stat.opens.toLocaleString()}</td>
                          <td className="px-4 py-3">{stat.clicks.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100">
                              {Math.round(stat.open_rate)}%
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                              {Math.round(stat.click_rate)}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Event RSVPs</CardTitle>
              <CardDescription>Registration counts for managed events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.eventAttendance}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#888' }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Legend />
                    <Bar name="Registered" dataKey="attendees" fill="#b79c65" radius={[4, 4, 0, 0]} />
                    <Bar name="Capacity" dataKey="capacity" fill="#e7e5e4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
