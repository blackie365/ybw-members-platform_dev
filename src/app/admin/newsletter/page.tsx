'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Send, Copy, Eye, Loader2, CheckCircle2, AlertCircle, TestTube, RefreshCw } from "lucide-react";
import { previewNewsletterAction, sendBulkNewsletterAction, sendTestNewsletterAction, getNewsletterRecipientStatsAction } from "@/app/actions/adminActions";
import { toast } from "sonner";

type NewsletterRecipientStats = {
  newsletter: number;
  registered: number;
  ghost: number;
  total: number;
  unique: number;
  beehiivEnabled: boolean;
};

export default function NewsletterAdminPage() {
  const [editorNote, setEditorNote] = useState("");
  const [subject, setSubject] = useState("Your Daily Briefing | Yorkshire Businesswoman");
  const [testEmail, setTestEmail] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [stats, setStats] = useState<NewsletterRecipientStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const editorNoteRef = useRef(editorNote);

  const fetchPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    const result = await previewNewsletterAction(editorNoteRef.current);
    if (result?.success && result?.html) {
      setPreviewHtml(result?.html);
    } else {
      toast?.error("Failed to load newsletter preview");
    }
    setIsLoadingPreview(false);
  }, []);

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    const result = await getNewsletterRecipientStatsAction();
    if (result?.success && result?.stats) {
      setStats(result.stats);
    } else {
      toast?.error(result?.error || "Failed to load recipient stats");
    }
    setIsLoadingStats(false);
  }, []);

  useEffect(() => {
    fetchPreview();
    fetchStats();
  }, [fetchPreview, fetchStats]);

  const handleCopyHtml = () => {
    if (previewHtml) {
      navigator.clipboard?.writeText(previewHtml);
      setCopySuccess(true);
      toast?.success("HTML copied to clipboard");
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const uniqueRecipientCount = stats?.unique ?? 0;

  const handleSendTest = async () => {
    if (!testEmail || !testEmail?.includes("@")) {
      toast?.error("Please enter a valid email address");
      return;
    }

    setIsSendingTest(true);
    const result = await sendTestNewsletterAction(testEmail, editorNote, subject);
    
    if (result?.success) {
      toast?.success(`Test email sent successfully to ${testEmail}!`);
    } else {
      toast?.error(`Failed to send test email: ${result?.error}`);
    }
    setIsSendingTest(false);
  };

  const handleSend = async () => {
    const countLabel = uniqueRecipientCount > 0 ? String(uniqueRecipientCount) : "all";
    if (!confirm(`Are you sure you want to send this newsletter to ${countLabel} recipients?`)) {
      return;
    }

    setIsSending(true);
    const result = await sendBulkNewsletterAction(editorNote, subject);
    
    if (result?.success) {
      toast?.success(`Newsletter sent successfully to ${result?.count} recipients (${result?.unique ?? "?"} unique)!`);
      // Refresh stats in case counts change after send
      void fetchStats();
    } else {
      toast?.error(`Failed to send newsletter: ${result?.error}`);
    }
    setIsSending(false);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Newsletter Manager</h1>
          <p className="text-muted-foreground">Draft and send your daily briefing to members.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleCopyHtml} disabled={!previewHtml}>
            {copySuccess ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            Copy HTML for Beehiiv
          </Button>
          <Button onClick={handleSend} disabled={isSending || !previewHtml} className="bg-accent hover:bg-accent/90">
            {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {uniqueRecipientCount > 0
              ? `Send to ${uniqueRecipientCount} Recipients`
              : "Send Newsletter"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Newsletter Content</CardTitle>
              <CardDescription>Customize the message before sending.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Subject</label>
                <Input 
                  value={subject}
                  onChange={(e) => setSubject(e?.target?.value)}
                  placeholder="Subject line..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Editor&apos;s Note (Optional)</label>
                <Textarea 
                  value={editorNote}
                  onChange={(e) => {
                    editorNoteRef.current = e.target.value;
                    setEditorNote(e.target.value);
                  }}
                  placeholder="Write a personal note from the editor..."
                  className="min-h-[150px] text-sm"
                />
              </div>
              <Button variant="secondary" className="w-full" onClick={fetchPreview} disabled={isLoadingPreview}>
                {isLoadingPreview ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                Update Preview
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recipient List</CardTitle>
                <CardDescription>Live counts from Firestore + Ghost.</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchStats()}
                disabled={isLoadingStats}
                className="h-8 w-8 p-0"
                aria-label="Refresh recipient stats"
              >
                {isLoadingStats ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!stats && isLoadingStats ? (
                <p className="text-muted-foreground">Loading counts…</p>
              ) : stats ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pop-up / inline sign-ups</span>
                    <span className="font-medium tabular-nums">{stats.newsletter}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Registered YBW members</span>
                    <span className="font-medium tabular-nums">{stats.registered}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ghost members (CMS)</span>
                    <span className="font-medium tabular-nums">{stats.ghost}</span>
                  </div>
                  <div className="border-t pt-3 mt-3 flex items-center justify-between">
                    <span className="font-semibold">Unique recipients</span>
                    <span className="font-bold text-lg tabular-nums text-accent">{stats.unique}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    {stats.beehiivEnabled
                      ? "Beehiiv sync enabled on this deploy."
                      : "Beehiiv is not configured on this deploy; this Resend send covers newsletter-only, registered, and Ghost list."}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Unable to load stats.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Send Test Email</CardTitle>
              <CardDescription>Send a draft to a single address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Recipient Email</label>
                <div className="flex gap-2">
                  <Input 
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e?.target?.value)}
                    placeholder="test@example.com"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSendTest} 
                    disabled={isSendingTest || !testEmail}
                    variant="secondary"
                    className="shrink-0"
                  >
                    {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-accent" />
                How to use
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2 text-muted-foreground leading-relaxed">
              <p>1. The newsletter automatically pulls the <strong>latest 5 stories</strong> from your Ghost magazine.</p>
              <p>2. Add an optional <strong>Editor&apos;s Note</strong> to personalize the message.</p>
              <p>3. <strong>Verify the live recipient count</strong> above — it includes newsletter popup sign-ups, registered members, and Ghost CMS members, deduplicated.</p>
              <p>4. Use <strong>&quot;Send to N Recipients&quot;</strong> to deliver via Resend immediately in batches of 40.</p>
              <p>5. Or <strong>&quot;Copy HTML&quot;</strong> if you prefer to use Beehiiv&apos;s dashboard manually.</p>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2">
          <Card className="h-full min-h-[800px] overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-accent" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[800px]">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-accent" />
                  <p className="text-sm text-muted-foreground font-medium">Generating preview...</p>
                </div>
              ) : previewHtml ? (
                <iframe 
                  srcDoc={previewHtml}
                  className="w-full h-full border-none shadow-inner"
                  title="Newsletter Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Failed to load preview.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
