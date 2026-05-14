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
import { Search, MoreHorizontal, Mail, UserCog, Download, Loader2 } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore"

interface Member {
  id: string
  displayName: string
  email: string
  photoURL?: string
  membershipTier: string
  role: string
  industry?: string
  location?: string
  createdAt: number
  lastLogin?: number
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tierFilter, setTierFilter] = useState<string>("all")
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    try {
      const membersRef = collection(db, "users")
      const q = query(membersRef, orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toMillis?.() || Date.now(),
        lastLogin: doc.data().lastLogin?.toMillis?.() || null,
      })) as Member[]
      setMembers(data)
    } catch (error) {
      console.error("Failed to fetch members:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateMemberTier = async (memberId: string, tier: string) => {
    setUpdating(memberId)
    try {
      const memberRef = doc(db, "users", memberId)
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
      const memberRef = doc(db, "users", memberId)
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

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      member.email?.toLowerCase().includes(search.toLowerCase()) ||
      member.industry?.toLowerCase().includes(search.toLowerCase())
    const matchesTier = tierFilter === "all" || member.membershipTier === tierFilter
    return matchesSearch && matchesTier
  })

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Never"
    return new Date(timestamp).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const exportMembers = () => {
    const csv = [
      ["Name", "Email", "Tier", "Role", "Industry", "Location", "Joined"],
      ...filteredMembers.map((m) => [
        m.displayName || "",
        m.email || "",
        m.membershipTier || "free",
        m.role || "member",
        m.industry || "",
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
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Members</h1>
          <p className="text-muted-foreground mt-1">
            Manage {members.length} community members
          </p>
        </div>
        <Button onClick={exportMembers} variant="outline" className="shrink-0">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
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
                <SelectItem value="professional">Professional</SelectItem>
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
                    <TableHead className="hidden md:table-cell">Industry</TableHead>
                    <TableHead className="hidden lg:table-cell">Joined</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.photoURL} alt={member.displayName} />
                            <AvatarFallback className="bg-accent/10 text-accent text-sm">
                              {member.displayName?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.displayName || "No name"}</p>
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
                            <SelectItem value="professional">Professional</SelectItem>
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
                      <TableCell className="hidden md:table-cell">
                        {member.industry || "-"}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
