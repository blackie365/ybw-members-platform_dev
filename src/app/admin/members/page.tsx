"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, Loader2, UserCog, Calendar, Tag } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPosts } from "@/lib/ghost";
import { getAllEventsMetadata, updateEventMetadata } from "@/app/actions/eventActions";

// Import domain-specific actions
import { 
  getMembersAction,
  toggleFeaturedStatus, 
  getFirestoreOffersAction, 
  approveOfferAction, 
  deleteOfferAction, 
  deactivateOfferAction, 
  updateOfferStatusAction, 
  toggleOfferVisibilityAction 
} from "@/app/actions/adminActions";

// Import modular sub-components
import { MemberTable, type Member } from "./MemberTable";
import { EventManager, type EventMetadata } from "./EventManager";
import { OfferManager, type Offer } from "./OfferManager";

function AdminMembersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("tab") || "members"

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

  // Offers state
  const [offers, setOffers] = useState<Offer[]>([])
  const [loadingOffers, setLoadingOffers] = useState(false)

  useEffect(() => {
    fetchMembers()
    fetchEvents()
    fetchOffers()
  }, [])

  const fetchMembers = async () => {
    setLoading(true)
    try {
      const res = await getMembersAction()
      if (res.success && res.data) {
        setMembers(res.data as Member[])
      }
    } catch (error) {
      console.error("Failed to fetch members:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOffers = async () => {
    setLoadingOffers(true)
    try {
      const res = await getFirestoreOffersAction()
      if (res.success && res.data) {
        setOffers(res.data as Offer[])
      } else {
        console.error("Failed to fetch offers:", res.error)
      }
    } catch (error) {
      console.error("Failed to fetch offers:", error)
    } finally {
      setLoadingOffers(false)
    }
  }

  const handleApproveOffer = async (offerId: string) => {
    setUpdating(offerId)
    try {
      const res = await approveOfferAction(offerId)
      if (res.success) {
        setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: 'active' } : o))
      } else {
        alert("Failed to approve offer: " + res.error)
      }
    } catch (error) {
      console.error("Failed to approve offer:", error)
      alert("Failed to approve offer")
    } finally {
      setUpdating(null)
    }
  }

  const handleDeactivateOffer = async (offerId: string) => {
    setUpdating(offerId)
    try {
      const res = await deactivateOfferAction(offerId)
      if (res.success) {
        setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: 'pending' } : o))
      } else {
        alert("Failed to deactivate offer: " + res.error)
      }
    } catch (error) {
      console.error("Failed to deactivate offer:", error)
      alert("Failed to deactivate offer")
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleOfferVisibility = async (offerId: string, isMembersOnly: boolean) => {
    setUpdating(offerId)
    try {
      const res = await toggleOfferVisibilityAction(offerId, isMembersOnly)
      if (res.success) {
        setOffers(prev => prev.map(o => o.id === offerId ? { ...o, isMembersOnly } : o))
      } else {
        alert("Failed to update visibility: " + res.error)
      }
    } catch (error) {
      console.error("Failed to update visibility:", error)
      alert("Failed to update visibility")
    } finally {
      setUpdating(null)
    }
  }

  const handleDeleteOffer = async (offerId: string) => {
    if (!confirm("Are you sure you want to delete this offer? This action cannot be undone.")) return

    setUpdating(offerId)
    try {
      const res = await deleteOfferAction(offerId)
      if (res.success) {
        setOffers(prev => prev.filter(o => o.id !== offerId))
      } else {
        alert("Failed to delete offer: " + res.error)
      }
    } catch (error) {
      console.error("Failed to delete offer:", error)
      alert("Failed to delete offer")
    } finally {
      setUpdating(null)
    }
  }

  const fetchEvents = async () => {
    setLoadingEvents(true)
    try {
      const ghostEvents = await getPosts({ filter: 'tag:events', limit: 'all' })
      setEvents(ghostEvents)

      const metadataRes = await getAllEventsMetadata()
      if (metadataRes.success && metadataRes.data) {
        setEventsMetadata(metadataRes.data)
        
        const initialPrices: Record<string, string> = {}
        ghostEvents.forEach((event: any) => {
          const meta = metadataRes.data?.[event.slug]
          if (typeof meta?.price === 'number') {
            initialPrices[event.slug] = meta.price.toString()
          } else {
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

  const handleToggleTicketCard = async (slug: string, currentEnabled?: boolean) => {
    const nextEnabled = currentEnabled === false
    setUpdating(slug)
    try {
      const currentMeta = eventsMetadata[slug] || {}
      const derivedPrice = (() => {
        const parsed = parseInt(editingPrice[slug] || '', 10)
        return Number.isFinite(parsed) ? parsed : 50
      })()

      const res = await updateEventMetadata(slug, {
        ticketCardEnabled: nextEnabled,
        price: currentMeta.price !== undefined ? currentMeta.price : derivedPrice,
        accessLevel: currentMeta.accessLevel || 'public',
      } as any)

      if (res.success) {
        setEventsMetadata(prev => ({
          ...prev,
          [slug]: { ...prev[slug], id: slug, ticketCardEnabled: nextEnabled }
        }))
      } else {
        alert("Failed to update Stripe card visibility: " + res.error)
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
        setMembers((prev) =>
          prev.map((m) => {
            if (m.id === memberId) return { ...m, isFeatured: !currentStatus }
            if (!currentStatus) return { ...m, isFeatured: false } 
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

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set("tab", value)
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl)
    router.replace(newUrl)
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="members" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Events Manager
          </TabsTrigger>
          <TabsTrigger value="offers" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Member Offers
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
                    <SelectItem value="complimentary">Complimentary</SelectItem>
                    <SelectItem value="paid_monthly">Paid Monthly</SelectItem>
                    <SelectItem value="paid_annual">Paid Annual</SelectItem>
                    <SelectItem value="premium">Premium (Legacy)</SelectItem>
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
                <MemberTable 
                  members={filteredMembers}
                  updating={updating}
                  updateMemberTier={updateMemberTier}
                  updateMemberRole={updateMemberRole}
                  handleToggleFeatured={handleToggleFeatured}
                  formatDate={formatDate}
                />
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
                <EventManager 
                  events={events}
                  eventsMetadata={eventsMetadata}
                  updating={updating}
                  editingPrice={editingPrice}
                  setEditingPrice={setEditingPrice}
                  handleUpdatePrice={handleUpdatePrice}
                  handleToggleAccess={handleToggleAccess}
                  handleToggleTicketCard={handleToggleTicketCard}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Member Offers</CardTitle>
                  <CardDescription>Review and manage member-submitted offers and discounts.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchOffers} disabled={loadingOffers}>
                  {loadingOffers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <OfferManager 
                offers={offers}
                loadingOffers={loadingOffers}
                updating={updating}
                handleApproveOffer={handleApproveOffer}
                handleDeactivateOffer={handleDeactivateOffer}
                handleToggleOfferVisibility={handleToggleOfferVisibility}
                handleDeleteOffer={handleDeleteOffer}
                updateOfferStatusAction={updateOfferStatusAction}
                fetchOffers={fetchOffers}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function AdminMembersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    }>
      <AdminMembersContent />
    </Suspense>
  )
}
