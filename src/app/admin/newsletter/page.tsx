'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Send, Copy, Eye, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { previewNewsletterAction, sendBulkNewsletterAction } from "@/app/actions/adminActions";
import { toast } from "sonner";

export default function NewsletterAdminPage() {
  const [editorNote, setEditorNote] = useState("");
  const [subject, setSubject] = useState("Your Daily Briefing | Yorkshire Businesswoman");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchPreview = async () => {
    setIsLoadingPreview(true);
    const result = await previewNewsletterAction(editorNote);
    if (result.success && result.html) {
      setPreviewHtml(result.html);
    } else {
      toast.error("Failed to load newsletter preview");
    }
    setIsLoadingPreview(false);
  };

  useEffect(() => {
    fetchPreview();
  }, []);

  const handleCopyHtml = () => {
    if (previewHtml) {
      navigator.clipboard.writeText(previewHtml);
      setCopySuccess(true);
      toast.success("HTML copied to clipboard");
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleSend = async () => {
    if (!confirm("Are you sure you want to send this newsletter to all 133 active members?")) {
      return;
    }

    setIsSending(true);
    const result = await sendBulkNewsletterAction(editorNote, subject);
    
    if (result.success) {
      toast.success(`Newsletter sent successfully to ${result.count} members!`);
    } else {
      toast.error(`Failed to send newsletter: ${result.error}`);
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
            Send to 133 Members
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
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Editor&apos;s Note (Optional)</label>
                <Textarea 
                  value={editorNote}
                  onChange={(e) => setEditorNote(e.target.value)}
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
              <p>3. Use <strong>&quot;Send to 133 Members&quot;</strong> to deliver via Resend immediately.</p>
              <p>4. Or <strong>&quot;Copy HTML&quot;</strong> if you prefer to use Beehiiv&apos;s dashboard manually.</p>
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
