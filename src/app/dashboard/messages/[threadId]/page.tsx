"use client"

import { useState, useEffect, useRef, use } from "react"
import { useAuth } from "@/lib/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, ArrowLeft, Send } from "lucide-react"
import type { Message, MessageThread } from "@/lib/messages"

export default function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params)
  const { user, loading: authLoading, profile } = useAuth()
  const router = useRouter()
  const [thread, setThread] = useState<MessageThread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/dashboard/messages")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && threadId) {
      fetchThread()
    }
  }, [user, threadId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const fetchThread = async () => {
    try {
      const res = await fetch(`/api/messages/${threadId}`)
      if (res.ok) {
        const data = await res.json()
        setThread(data.thread)
        setMessages(data.messages)
      } else if (res.status === 404) {
        router.push("/dashboard/messages")
      }
    } catch (error) {
      console.error("Failed to fetch thread:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch(`/api/messages/${threadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
        setNewMessage("")
      }
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDateDivider = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    return date.toLocaleDateString("en-GB", { 
      weekday: "long", 
      day: "numeric", 
      month: "long" 
    })
  }

  const shouldShowDateDivider = (current: Message, previous: Message | null) => {
    if (!previous) return true
    const currentDate = new Date(current.createdAt).toDateString()
    const previousDate = new Date(previous.createdAt).toDateString()
    return currentDate !== previousDate
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  const otherParticipant = thread?.participantNames?.find(
    (name) => name !== profile?.displayName
  ) || "Unknown"
  const otherPhoto = thread?.participantPhotos?.find(
    (_, idx) => thread?.participantNames?.[idx] !== profile?.displayName
  )

  return (
    <div className="container max-w-3xl py-8 h-[calc(100vh-12rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/messages">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarImage src={otherPhoto} alt={otherParticipant} />
          <AvatarFallback className="bg-accent/10 text-accent font-semibold">
            {otherParticipant.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-semibold text-lg">{otherParticipant}</h1>
          <p className="text-sm text-muted-foreground">Member</p>
        </div>
      </div>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden border-accent/10 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Start your conversation with {otherParticipant}</p>
            </div>
          ) : (
            messages.map((message, idx) => {
              const isOwn = message.senderId === user?.uid
              const showDateDivider = shouldShowDateDivider(message, messages[idx - 1] || null)

              return (
                <div key={message.id}>
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-4">
                      <span className="text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border">
                        {formatDateDivider(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        isOwn
                          ? "bg-accent text-white rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <span
                        className={`text-xs mt-1 block ${
                          isOwn ? "text-white/70" : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sending}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={!newMessage.trim() || sending}
            className="bg-accent hover:bg-accent/90 text-white"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </Card>
    </div>
  )
}
