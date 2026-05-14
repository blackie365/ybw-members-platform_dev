"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Calendar, MapPin, Users, Loader2, Edit, Trash2 } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from "firebase/firestore"
import type { Event } from "@/lib/events"

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    type: "networking" as Event["type"],
    capacity: 50,
    price: 0,
    isPaid: false,
    memberOnly: true,
  })

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      const eventsRef = collection(db, "events")
      const q = query(eventsRef, orderBy("date", "desc"))
      const snap = await getDocs(q)
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toMillis?.() || Date.now(),
        createdAt: doc.data().createdAt?.toMillis?.() || Date.now(),
      })) as Event[]
      setEvents(data)
    } catch (error) {
      console.error("Failed to fetch events:", error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      date: "",
      time: "",
      location: "",
      type: "networking",
      capacity: 50,
      price: 0,
      isPaid: false,
      memberOnly: true,
    })
    setEditingEvent(null)
  }

  const openEditDialog = (event: Event) => {
    const eventDate = new Date(event.date)
    setForm({
      title: event.title,
      description: event.description,
      date: eventDate.toISOString().split("T")[0],
      time: eventDate.toTimeString().slice(0, 5),
      location: event.location,
      type: event.type,
      capacity: event.capacity || 50,
      price: event.price || 0,
      isPaid: event.isPaid || false,
      memberOnly: event.memberOnly ?? true,
    })
    setEditingEvent(event)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const dateTime = new Date(`${form.date}T${form.time}`)
      const slug = form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")

      const eventData = {
        title: form.title,
        description: form.description,
        date: Timestamp.fromDate(dateTime),
        location: form.location,
        type: form.type,
        capacity: form.capacity,
        price: form.isPaid ? form.price : 0,
        isPaid: form.isPaid,
        memberOnly: form.memberOnly,
        slug,
        attendees: editingEvent?.attendees || [],
        status: "published" as const,
      }

      if (editingEvent) {
        await updateDoc(doc(db, "events", editingEvent.id), eventData)
      } else {
        await addDoc(collection(db, "events"), {
          ...eventData,
          createdAt: Timestamp.now(),
        })
      }

      setDialogOpen(false)
      resetForm()
      fetchEvents()
    } catch (error) {
      console.error("Failed to save event:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return

    try {
      await deleteDoc(doc(db, "events", eventId))
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
    } catch (error) {
      console.error("Failed to delete event:", error)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const typeBadgeColors: Record<string, string> = {
    networking: "bg-blue-100 text-blue-800",
    workshop: "bg-purple-100 text-purple-800",
    conference: "bg-amber-100 text-amber-800",
    webinar: "bg-green-100 text-green-800",
    social: "bg-pink-100 text-pink-800",
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground mt-1">
            Manage {events.length} events
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 text-white shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEvent ? "Edit Event" : "Create Event"}</DialogTitle>
              <DialogDescription>
                {editingEvent ? "Update event details" : "Add a new event for your members"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Spring Networking Lunch"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the event..."
                  rows={3}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. The Grand Hotel, Leeds"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Event Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(value) => setForm((f) => ({ ...f, type: value as Event["type"] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="networking">Networking</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="conference">Conference</SelectItem>
                      <SelectItem value="webinar">Webinar</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: parseInt(e.target.value) || 50 }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="isPaid">Paid Event</Label>
                  <p className="text-sm text-muted-foreground">Charge for attendance</p>
                </div>
                <Switch
                  id="isPaid"
                  checked={form.isPaid}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isPaid: checked }))}
                />
              </div>
              {form.isPaid && (
                <div className="space-y-2">
                  <Label htmlFor="price">Price (GBP)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="memberOnly">Members Only</Label>
                  <p className="text-sm text-muted-foreground">Restrict to registered members</p>
                </div>
                <Switch
                  id="memberOnly"
                  checked={form.memberOnly}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, memberOnly: checked }))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-accent hover:bg-accent/90 text-white">
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingEvent ? "Update Event" : "Create Event"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </CardContent>
          </Card>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg">No events yet</h3>
              <p className="text-muted-foreground mt-1">
                Create your first event to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          events.map((event) => (
            <Card key={event.id} className="hover:border-accent/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="text-center bg-accent/10 rounded-lg p-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.date).toLocaleDateString("en-GB", { month: "short" })}
                        </span>
                        <p className="text-2xl font-bold text-accent">
                          {new Date(event.date).getDate()}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{event.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {event.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(event.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {event.attendees?.length || 0} / {event.capacity}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className={typeBadgeColors[event.type] || "bg-muted"}>
                        {event.type}
                      </Badge>
                      {event.isPaid && (
                        <Badge variant="outline">£{event.price}</Badge>
                      )}
                      {event.memberOnly && (
                        <Badge variant="secondary">Members Only</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(event)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(event.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
