import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";

export interface EventMetadata {
  id: string
  price?: number
  memberPrice?: number
  accessLevel?: 'public' | 'members-only'
  ticketCardEnabled?: boolean
  capacity?: number
  updatedAt?: string
}

interface EventManagerProps {
  events: any[]
  eventsMetadata: Record<string, EventMetadata>
  updating: string | null
  editingPrice: Record<string, string>
  editingMemberPrice: Record<string, string>
  setEditingPrice: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setEditingMemberPrice: React.Dispatch<React.SetStateAction<Record<string, string>>>
  handleUpdatePrice: (slug: string) => void
  handleToggleAccess: (slug: string, currentLevel?: 'public' | 'members-only') => void
  handleToggleTicketCard: (slug: string, currentEnabled?: boolean) => void
}

export function EventManager({
  events,
  eventsMetadata,
  updating,
  editingPrice,
  editingMemberPrice,
  setEditingPrice,
  setEditingMemberPrice,
  handleUpdatePrice,
  handleToggleAccess,
  handleToggleTicketCard,
}: EventManagerProps) {
  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Current Price</TableHead>
            <TableHead>New Standard (£)</TableHead>
            <TableHead>New Member (£)</TableHead>
            <TableHead className="text-center">Members Only</TableHead>
            <TableHead className="text-center">Stripe Card</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const meta = eventsMetadata[event.slug]
            const isUpdating = updating === event.slug
            const isMembersOnly = meta?.accessLevel === 'members-only'
            const isTicketCardEnabled = meta?.ticketCardEnabled === true
            return (
              <TableRow key={event.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{event.title}</span>
                    <span className="text-xs text-muted-foreground">{event.slug}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm">
                    {typeof meta?.price === 'number' ? (
                      <span className="text-green-600 font-medium">Std: £{meta.price}</span>
                    ) : (
                      <span className="text-muted-foreground italic">Std: Unset</span>
                    )}
                    {typeof meta?.memberPrice === 'number' ? (
                      <span className="text-blue-600 font-medium">Mem: £{meta.memberPrice}</span>
                    ) : (
                      <span className="text-muted-foreground italic">Mem: Unset</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      placeholder="e.g. 50" 
                      className="w-20"
                      value={editingPrice[event.slug] || ""}
                      onChange={(e) => setEditingPrice(prev => ({ ...prev, [event.slug]: e.target.value }))}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      placeholder="e.g. 40" 
                      className="w-20"
                      value={editingMemberPrice[event.slug] || ""}
                      onChange={(e) => setEditingMemberPrice(prev => ({ ...prev, [event.slug]: e.target.value }))}
                    />
                  </div>
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
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <Switch
                      checked={isTicketCardEnabled}
                      onCheckedChange={() => handleToggleTicketCard(event.slug, meta?.ticketCardEnabled)}
                      disabled={isUpdating}
                    />
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">
                      {isTicketCardEnabled ? 'Shown' : 'Hidden'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-9 gap-2 border-accent text-accent hover:bg-accent hover:text-white"
                    disabled={isUpdating || (!editingPrice[event.slug] && !editingMemberPrice[event.slug])}
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
    </div>
  )
}
