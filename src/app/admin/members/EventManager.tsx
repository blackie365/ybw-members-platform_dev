import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save } from "lucide-react"

export interface EventMetadata {
  id: string
  price: number
  accessLevel?: 'public' | 'members-only'
  capacity?: number
  updatedAt?: string
}

interface EventManagerProps {
  events: any[]
  eventsMetadata: Record<string, EventMetadata>
  updating: string | null
  editingPrice: Record<string, string>
  setEditingPrice: React.Dispatch<React.SetStateAction<Record<string, string>>>
  handleUpdatePrice: (slug: string) => void
  handleToggleAccess: (slug: string, currentAccess?: string) => void
}

export function EventManager({
  events,
  eventsMetadata,
  updating,
  editingPrice,
  setEditingPrice,
  handleUpdatePrice,
  handleToggleAccess,
}: EventManagerProps) {
  return (
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
  )
}
