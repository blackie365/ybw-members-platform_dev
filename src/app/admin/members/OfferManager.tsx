import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ExternalLink, Loader2, Trash2 } from "lucide-react"

export interface Offer {
  id: string
  title: string
  description: string
  link?: string
  imageUrl?: string
  isMembersOnly?: boolean
  userId: string
  userEmail: string
  userName: string
  status: 'pending' | 'active' | 'expired'
  createdAt: string
}

interface OfferManagerProps {
  offers: Offer[]
  loadingOffers: boolean
  updating: string | null
  handleApproveOffer: (id: string) => void
  handleDeactivateOffer: (id: string) => void
  handleToggleOfferVisibility: (id: string, isMembersOnly: boolean) => void
  handleDeleteOffer: (id: string) => void
  updateOfferStatusAction: (id: string, status: any) => Promise<any>
  fetchOffers: () => void
}

export function OfferManager({
  offers,
  loadingOffers,
  updating,
  handleApproveOffer,
  handleDeactivateOffer,
  handleToggleOfferVisibility,
  handleDeleteOffer,
  updateOfferStatusAction,
  fetchOffers,
}: OfferManagerProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Member</TableHead>
            <TableHead>Offer Details</TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loadingOffers ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : offers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No offers found.
              </TableCell>
            </TableRow>
          ) : (
            offers.map((offer) => (
              <TableRow key={offer.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      {new Date(offer.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{offer.userName}</span>
                    <span className="text-xs text-muted-foreground">{offer.userEmail}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 max-w-md">
                    <span className="font-semibold">{offer.title}</span>
                    <p className="text-xs text-muted-foreground line-clamp-2">{offer.description}</p>
                    {offer.link && (
                      <a 
                        href={offer.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[10px] text-accent flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Link
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={!offer.isMembersOnly} 
                      onCheckedChange={(checked) => handleToggleOfferVisibility(offer.id, !checked)}
                      disabled={updating === offer.id}
                    />
                    <span className="text-xs text-muted-foreground">
                      {offer.isMembersOnly ? 'Members Only' : 'Public'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={offer.status}
                    onValueChange={(value: 'active' | 'pending' | 'expired') => {
                      if (value === 'active') handleApproveOffer(offer.id)
                      else if (value === 'pending') handleDeactivateOffer(offer.id)
                      else updateOfferStatusAction(offer.id, value).then(() => fetchOffers())
                    }}
                    disabled={updating === offer.id}
                  >
                    <SelectTrigger className="w-[110px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/5"
                      onClick={() => handleDeleteOffer(offer.id)}
                      disabled={updating === offer.id}
                    >
                      {updating === offer.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
