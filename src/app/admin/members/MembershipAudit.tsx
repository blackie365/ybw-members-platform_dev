"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw } from "lucide-react";

type MembershipAuditRow = {
  id: string;
  email: string;
  displayName: string;
  appTier: string;
  appStatus: "free" | "paid";
  appPlanLabel: string;
  stripeStatus: string;
  stripePlanLabel: string;
  stripeInterval: "monthly" | "yearly" | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  renewalDate: string | null;
  ghostExists: boolean;
  ghostLabels: string[];
  ghostName: string;
  hasIssues: boolean;
  notes: string[];
};

type MembershipAuditSummary = {
  totalMembers: number;
  paidMembers: number;
  freeMembers: number;
  rowsWithIssues: number;
  ghostMissing: number;
  ghostOnlyCount: number;
  stripeConfigured: boolean;
  ghostConfigured: boolean;
};

type GhostOnlyMember = {
  email: string;
  name: string;
  labels: string[];
};

interface MembershipAuditProps {
  rows: MembershipAuditRow[];
  summary: MembershipAuditSummary | null;
  ghostOnlyMembers: GhostOnlyMember[];
  loading: boolean;
  onRefresh: () => void;
}

type AuditFilter = "all" | "issues" | "paid" | "ghost-missing";

function formatDate(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getAppBadgeClass(status: "free" | "paid") {
  return status === "paid"
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : "bg-slate-100 text-slate-700 border-slate-200";
}

function getStripeBadgeClass(status: string) {
  if (status === "active" || status === "trialing") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (status === "past_due" || status === "unpaid") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (status === "canceled") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function MembershipAudit({
  rows,
  summary,
  ghostOnlyMembers,
  loading,
  onRefresh,
}: MembershipAuditProps) {
  const [filter, setFilter] = useState<AuditFilter>("all");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const byFilter = (() => {
      switch (filter) {
        case "issues":
          return rows.filter((row) => row.hasIssues);
        case "paid":
          return rows.filter((row) => row.appStatus === "paid");
        case "ghost-missing":
          return rows.filter((row) => !row.ghostExists);
        case "all":
        default:
          return rows;
      }
    })();

    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) return byFilter;

    return byFilter.filter((row) => {
      return (
        row.displayName.toLowerCase().includes(searchTerm) ||
        row.email.toLowerCase().includes(searchTerm)
      );
    });
  }, [filter, rows, search]);

  const downloadCsv = (fileName: string, bodyRows: string[][]) => {
    const csv = [
      [
        "Record Type",
        "Name",
        "Email",
        "App Status",
        "Stripe Status",
        "Renewal Date",
        "Ghost Exists",
        "Ghost Labels",
        "Notes",
      ],
      ...bodyRows,
    ]
      .map((row) => row.map((cell) => escapeCsvCell(String(cell || ""))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportMismatches = () => {
    const mismatchRows = filteredRows
      .filter((row) => row.hasIssues)
      .map((row) => [
        "app-member",
        row.displayName,
        row.email,
        row.appPlanLabel,
        row.stripePlanLabel,
        formatDate(row.renewalDate),
        row.ghostExists ? "yes" : "no",
        row.ghostLabels.join(", "),
        row.notes.join(" | "),
      ]);

    const ghostOnlyRows = ghostOnlyMembers.map((member) => [
      "ghost-only",
      member.name || "",
      member.email,
      "",
      "",
      "",
      "yes",
      member.labels.join(", "),
      "Exists in Ghost but not in app members",
    ]);

    downloadCsv("membership-audit-mismatches", [...mismatchRows, ...ghostOnlyRows]);
  };

  const exportFullAudit = () => {
    const fullRows = filteredRows.map((row) => [
      "app-member",
      row.displayName,
      row.email,
      row.appPlanLabel,
      row.stripePlanLabel,
      formatDate(row.renewalDate),
      row.ghostExists ? "yes" : "no",
      row.ghostLabels.join(", "),
      row.notes.join(" | "),
    ]);

    const ghostOnlyRows = ghostOnlyMembers.map((member) => [
      "ghost-only",
      member.name || "",
      member.email,
      "",
      "",
      "",
      "yes",
      member.labels.join(", "),
      "Exists in Ghost but not in app members",
    ]);

    downloadCsv("membership-audit-full", [...fullRows, ...ghostOnlyRows]);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>App Members</CardDescription>
            <CardTitle className="text-2xl">{summary?.totalMembers ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid</CardDescription>
            <CardTitle className="text-2xl">{summary?.paidMembers ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Free</CardDescription>
            <CardTitle className="text-2xl">{summary?.freeMembers ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rows With Issues</CardDescription>
            <CardTitle className="text-2xl">{summary?.rowsWithIssues ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ghost Only</CardDescription>
            <CardTitle className="text-2xl">{summary?.ghostOnlyCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Membership Audit</CardTitle>
            <CardDescription>
              Cross-checks app records against Stripe and Ghost using member email.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email..."
              className="w-[220px]"
            />
            <Select value={filter} onValueChange={(value) => setFilter(value as AuditFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter rows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rows</SelectItem>
                <SelectItem value="issues">Issues only</SelectItem>
                <SelectItem value="paid">Paid only</SelectItem>
                <SelectItem value="ghost-missing">Missing in Ghost</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={exportFullAudit}
              disabled={loading || (filteredRows.length === 0 && ghostOnlyMembers.length === 0)}
            >
              <Download className="mr-2 h-4 w-4" />
              Export full audit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportMismatches}
              disabled={loading || (filteredRows.filter((row) => row.hasIssues).length === 0 && ghostOnlyMembers.length === 0)}
            >
              <Download className="mr-2 h-4 w-4" />
              Export mismatches
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh audit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={summary?.stripeConfigured ? "border-emerald-200 text-emerald-800" : "border-amber-200 text-amber-800"}>
              Stripe {summary?.stripeConfigured ? "configured" : "not configured"}
            </Badge>
            <Badge variant="outline" className={summary?.ghostConfigured ? "border-emerald-200 text-emerald-800" : "border-amber-200 text-amber-800"}>
              Ghost {summary?.ghostConfigured ? "configured" : "not configured"}
            </Badge>
            <Badge variant="outline" className="border-slate-200 text-slate-700">
              Ghost missing: {summary?.ghostMissing ?? 0}
            </Badge>
            <Badge variant="outline" className="border-slate-200 text-slate-700">
              Showing: {filteredRows.length}
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              Run the audit to load the latest member reconciliation report.
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              No members match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Stripe</TableHead>
                    <TableHead>Renews</TableHead>
                    <TableHead>Ghost</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{row.displayName}</span>
                          <span className="text-sm text-muted-foreground">{row.email || "No email"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Badge variant="outline" className={getAppBadgeClass(row.appStatus)}>
                            {row.appPlanLabel}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Tier: {row.appTier}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Badge variant="outline" className={getStripeBadgeClass(row.stripeStatus)}>
                            {row.stripePlanLabel}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Status: {row.stripeStatus}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(row.renewalDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            {row.ghostExists ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                            )}
                            <span className="text-sm">
                              {row.ghostExists ? "Present" : "Missing"}
                            </span>
                          </div>
                          {row.ghostLabels.length > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {row.ghostLabels.join(", ")}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.notes.length === 0 ? (
                          <span className="text-sm text-emerald-700">No issues found</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {row.notes.map((note) => (
                              <span key={note} className="text-sm text-amber-800">
                                {note}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ghost-Only Records</CardTitle>
          <CardDescription>
            These emails exist in Ghost but do not currently match an app member.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ghostOnlyMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Ghost-only records found.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Labels</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ghostOnlyMembers.map((member) => (
                    <TableRow key={member.email}>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.name || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.labels.length > 0 ? member.labels.join(", ") : "-"}
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
  );
}
