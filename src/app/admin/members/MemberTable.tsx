import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Mail, UserCog, MoreHorizontal } from "lucide-react";

export interface Member {
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

interface MemberTableProps {
  members: Member[]
  updating: string | null
  updateMemberTier: (id: string, tier: string) => void
  updateMemberRole: (id: string, role: string) => void
  handleToggleFeatured: (id: string, status: boolean) => void
  formatDate: (date: string | null) => string
}

export function MemberTable({
  members,
  updating,
  updateMemberTier,
  updateMemberRole,
  handleToggleFeatured,
  formatDate,
}: MemberTableProps) {
  return (
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
          {members.map((member) => {
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
                      <SelectItem value="complimentary">Complimentary</SelectItem>
                      <SelectItem value="paid_monthly">Paid Monthly</SelectItem>
                      <SelectItem value="paid_annual">Paid Annual</SelectItem>
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
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
