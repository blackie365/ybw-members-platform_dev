"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, MoreHorizontal, Mail, UserCog, Download, Loader2, Star, Calendar, Save } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore"
import { Switch } from "@/components/ui/switch"
import { toggleFeaturedStatus } from "@/app/actions/adminActions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getPosts } from "@/lib/ghost"
import { getAllEventsMetadata, updateEventMetadata } from "@/app/actions/eventActions"

interface Member {
  id: string
  firstName: string
  lastName: string
  displayName?: string
  email: string
  profileImage?: string
  avatarUrl?: string
  membershipTier: string
  role: string
  industrySector?: string
  location?: string
  status?: string
  isFeatured?: boolean
  createdAt: string
  updatedAt?: string
}

interface EventMetadata {
  id: string
  price: number
  accessLevel?: 'public' | 'members-only'
  capacity?: number
  updatedAt?: string
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tierFilter, setTierFilter] = useState<string>("all")
  const [updating, setUpdating] = useState<string | null>(null)

  // Events state
  const [events, setEvents] = useState<any[]>([])
  const [eventsMetadata, setEventsMetadata] = useState<Record<string, EventMetadata>>({})
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchMembers()
    fetchEvents()
  }, [])

  const fetchMembers = async () => {
    try {
      const membersRef = collection(db, "newMemberCollection")
      const q = query(membersRef, orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Member[]
      setMembers(data)
    } catch (error) {
      console.error("Failed to fetch members:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEvents = async () => {
    setLoadingEvents(true)
    try {
      // 1. Get Ghost posts with 'events' tag
      const ghostEvents = await getPosts({ filter: 'tag:events', limit: 'all' })
      setEvents(ghostEvents)

      // 2. Get Firestore metadata for these events
      const metadataRes = await getAllEventsMetadata()
      if (metadataRes.success && metadataRes.data) {
        setEventsMetadata(metadataRes.data)
        
        // Initialize editing state with current prices
        const initialPrices: Record<string, string> = {}
        ghostEvents.forEach((event: any) => {
          const meta = metadataRes.data?.[event.slug]
          if (meta) {
            initialPrices[event.slug] = meta.price.toString()
          } else {
            // Check if there's a price tag in Ghost as fallback
            const priceTag = event.tags?.find((t: any) => t.slug.includes('ticket-price'))
            if (priceTag) {
              const digits = priceTag.slug.match(/\d+/)
              if (digits) initialPrices[event.slug] = digits[0]
            }
          }
        })
        setEditingPrice(initialPrices)
      }
    } catch (error) {
      console.error("Failed to fetch events:", error)
    } finally {
      setLoadingEvents(false)
    }
  }

  const handleUpdatePrice = async (slug: string) => {
    const price = parseInt(editingPrice[slug], 10)
    if (isNaN(price)) {
      alert("Please enter a valid numeric price")
      return
    }

    setUpdating(slug)
    try {
      const currentMeta = eventsMetadata[slug] || {}
      const res = await updateEventMetadata(slug, { 
        price,
        accessLevel: currentMeta.accessLevel || 'public' 
      } as any)
      
      if (res.success) {
        setEventsMetadata(prev => ({
          ...prev,
          [slug]: { ...prev[slug], id: slug, price }
        }))
        alert(`Price for ${slug} updated to £${price}`)
      } else {
        alert("Failed to update: " + res.error)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleAccess = async (slug: string, currentAccess?: string) => {
    const newAccess = currentAccess === 'members-only' ? 'public' : 'members-only'
    setUpdating(slug)
    try {
      const currentMeta = eventsMetadata[slug] || {}
      const res = await updateEventMetadata(slug, { 
        accessLevel: newAccess,
        price: currentMeta.price !== undefined ? currentMeta.price : 50 
      } as any)
      
      if (res.success) {
        setEventsMetadata(prev => ({
          ...prev,
          [slug]: { ...prev[slug], id: slug, accessLevel: newAccess as any }
        }))
      } else {
        alert("Failed to update access: " + res.error)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUpdating(null)
    }
  }

  const updateMemberTier = async (memberId: string, tier: string) => {
    setUpdating(memberId)
    try {
      const memberRef = doc(db, "newMemberCollection", memberId)
      await updateDoc(memberRef, { membershipTier: tier })
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, membershipTier: tier } : m))
      )
    } catch (error) {
      console.error("Failed to update tier:", error)
    } finally {
      setUpdating(null)
    }
  }

  const updateMemberRole = async (memberId: string, role: string) => {
    setUpdating(memberId)
    try {
      const memberRef = doc(db, "newMemberCollection", memberId)
      await updateDoc(memberRef, { role })
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m))
      )
    } catch (error) {
      console.error("Failed to update role:", error)
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleFeatured = async (memberId: string, currentStatus: boolean) => {
    setUpdating(memberId)
    try {
      const res = await toggleFeaturedStatus(memberId, !currentStatus)
      if (res.success) {
        // If we set one to true, others might have been set to false by the server action
        // For simplicity and correctness, let's just refetch or update locally
        setMembers((prev) =>
          prev.map((m) => {
            if (m.id === memberId) return { ...m, isFeatured: !currentStatus }
            if (!currentStatus) return { ...m, isFeatured: false } // If setting new one to true, others become false
            return m
          })
        )
      } else {
        alert(res.error || "Failed to update featured status")
      }
    } catch (error) {
      console.error("Failed to toggle featured status:", error)
    } finally {
      setUpdating(null)
    }
  }

  const filteredMembers = members.filter((member) => {
    const fullName = `${member.firstName || ""} ${member.lastName || ""}`.toLowerCase()
    const displayName = (member.displayName || "").toLowerCase()
    const email = (member.email || "").toLowerCase()
    const industry = (member.industrySector || "").toLowerCase()
    const searchTerm = search.toLowerCase().trim()

    const matchesSearch =
      fullName.includes(searchTerm) ||
      displayName.includes(searchTerm) ||
      email.includes(searchTerm) ||
      industry.includes(searchTerm)
    
    const matchesTier = tierFilter === "all" || member.membershipTier === tierFilter
    return matchesSearch && matchesTier
  })

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never"
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const exportMembers = () => {
    const csv = [
      ["First Name", "Last Name", "Email", "Tier", "Role", "Industry", "Location", "Joined"],
      ...filteredMembers.map((m) => [
        m.firstName || "",
        m.lastName || "",
        m.email || "",
        m.membershipTier || "free",
        m.role || "member",
        m.industrySector || "",
        m.location || "",
        formatDate(m.createdAt),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `members-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const tierBadgeColors: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    premium: "bg-accent/10 text-accent",
    professional: "bg-amber-100 text-amber-800",
    founder: "bg-purple-100 text-purple-800",
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your community and events
          </p>
        </div>
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="members" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Events Manager
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle>Members</CardTitle>
                <CardDescription>Manage {members.length} community members</CardDescription>
              </div>
              <Button onClick={exportMembers} variant="outline" size="sm" className="shrink-0">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardHeader className="pt-0 pb-4 border-b">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or industry..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tiers</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="founder">Founder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No members found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-center">Featured</TableHead>
                        <TableHead className="hidden md:table-cell">Industry</TableHead>
                        <TableHead className="hidden lg:table-cell">Joined</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => {
                        const fullName = member.displayName || `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unknown Member"
                        const initial = (member.firstName?.[0] || member.displayName?.[0] || "?").toUpperCase()

                        return (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={member.avatarUrl || member.profileImage} alt={fullName} />
                                  <AvatarFallback className="bg-accent/10 text-accent text-sm">
                                    {initial}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{fullName}</p>
                                  <p className="text-sm text-muted-foreground">{member.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={member.membershipTier || "free"}
                                onValueChange={(value) => updateMemberTier(member.id, value)}
                                disabled={updating === member.id}
                              >
                                <SelectTrigger className="w-[130px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="free">Free</SelectItem>
                                  <SelectItem value="premium">Premium</SelectItem>
                                  <SelectItem value="founder">Founder</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={member.role || "member"}
                                onValueChange={(value) => updateMemberRole(member.id, value)}
                                disabled={updating === member.id}
                              >
                                <SelectTrigger className="w-[110px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center">
                                <Switch
                                  checked={!!member.isFeatured}
                                  onCheckedChange={() => handleToggleFeatured(member.id, !!member.isFeatured)}
                                  disabled={updating === member.id}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {member.industrySector || "-"}
                            </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                            {formatDate(member.createdAt)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <a href={`mailto:${member.email}`}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send email
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a href={`/members/${member.id}`} target="_blank">
                                    <UserCog className="h-4 w-4 mr-2" />
                                    View profile
                                  </a>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Events Manager</CardTitle>
              <CardDescription>
                Set ticket prices for events published in Ghost. Prices set here override Ghost tags.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No events found in Ghost
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Current Price</TableHead>
                      <TableHead>New Price (£)</TableHead>
                      <TableHead className="text-center">Members Only</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => {
                      const meta = eventsMetadata[event.slug]
                      const isUpdating = updating === event.slug
                      const isMembersOnly = meta?.accessLevel === 'members-only'
                      return (
                        <TableRow key={event.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{event.title}</span>
                              <span className="text-xs text-muted-foreground">{event.slug}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {meta ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                                £{meta.price} (Live)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Using Tag/Default
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24 h-9"
                              placeholder="e.g. 50"
                              value={editingPrice[event.slug] || ""}
                              onChange={(e) => setEditingPrice(prev => ({ ...prev, [event.slug]: e.target.value }))}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Switch 
                                checked={isMembersOnly}
                                onCheckedChange={() => handleToggleAccess(event.slug, meta?.accessLevel)}
                                disabled={isUpdating}
                              />
                              <span className="text-[10px] text-muted-foreground uppercase font-medium">
                                {isMembersOnly ? 'Private' : 'Public'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-9 gap-2 border-accent text-accent hover:bg-accent hover:text-white"
                              disabled={isUpdating}
                              onClick={() => handleUpdatePrice(event.slug)}
                            >
                              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Save
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

