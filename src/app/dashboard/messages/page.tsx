"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, MessageSquare, Search, PenSquare } from "lucide-react"
import type { MessageThread } from "@/lib/messages"

export default function MessagesPage() {
  const { user, loading: authLoading, profile } = useAuth()
  const router = useRouter()
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/dashboard/messages")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchThreads()
    }
  }, [user])

  const fetchThreads = async () => {
    try {
      const res = await fetch("/api/messages")
      if (res.ok) {
        const data = await res.json()
        setThreads(data.threads)
      }
    } catch (error) {
      console.error("Failed to fetch threads:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredThreads = threads.filter((thread) => {
    const otherParticipant = thread.participantNames?.find(
      (name) => name !== profile?.displayName
    )
    return otherParticipant?.toLowerCase().includes(search.toLowerCase())
  })

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    } else if (days === 1) {
      return "Yesterday"
    } else if (days < 7) {
      return date.toLocaleDateString("en-GB", { weekday: "short" })
    }
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground mt-1">
            Connect with fellow members
          </p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-white">
          <Link href="/dashboard/directory">
            <PenSquare className="h-4 w-4 mr-2" />
            New Message
          </Link>
        </Button>
      </div>

      <Card className="border-accent/10">
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg">No conversations yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                Start connecting with other members by visiting the{" "}
                <Link href="/dashboard/directory" className="text-accent hover:underline">
                  member directory
                </Link>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredThreads.map((thread) => {
                const otherParticipant = thread.participantNames?.find(
                  (name) => name !== profile?.displayName
                ) || "Unknown"
                const otherPhoto = thread.participantPhotos?.find(
                  (_, idx) => thread.participantNames?.[idx] !== profile?.displayName
                )
                const isUnread = thread.unreadCount && thread.unreadCount > 0

                return (
                  <Link
                    key={thread.id}
                    href={`/dashboard/messages/${thread.id}`}
                    className={`flex items-center gap-4 p-4 hover:bg-accent/5 transition-colors ${
                      isUnread ? "bg-accent/5" : ""
                    }`}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={otherPhoto} alt={otherParticipant} />
                      <AvatarFallback className="bg-accent/10 text-accent font-semibold">
                        {otherParticipant.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-semibold truncate ${isUnread ? "text-foreground" : "text-foreground/80"}`}>
                          {otherParticipant}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {thread.lastMessageAt && formatDate(thread.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className={`text-sm truncate ${isUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {thread.lastMessage || "No messages yet"}
                        </p>
                        {isUnread && (
                          <Badge className="bg-accent text-white shrink-0">
                            {thread.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
