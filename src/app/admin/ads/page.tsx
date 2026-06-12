'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getAdsConfigAction, updateHeaderLeaderboardAdAction } from '@/app/actions/adsActions';

type HeaderLeaderboardAd = {
  enabled?: boolean;
  imageUrl?: string;
  linkUrl?: string;
  altText?: string;
};

export default function AdsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [headerAd, setHeaderAd] = useState<HeaderLeaderboardAd>({
    enabled: true,
    imageUrl: '',
    linkUrl: '',
    altText: 'Advertisement',
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const result = await getAdsConfigAction();
      if (!mounted) return;
      if (result.success) {
        setHeaderAd({
          enabled: result.data.headerLeaderboard?.enabled !== false,
          imageUrl: result.data.headerLeaderboard?.imageUrl || '',
          linkUrl: result.data.headerLeaderboard?.linkUrl || '',
          altText: result.data.headerLeaderboard?.altText || 'Advertisement',
        });
      } else {
        toast.error(result.error);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const uploadHeaderImage = async (file: File) => {
    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('folder', 'ads/header-leaderboard');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadRes.ok) {
        const uploadData = await uploadRes.json().catch(() => ({}));
        throw new Error(uploadData.error || 'Failed to upload image');
      }

      const { url } = await uploadRes.json();
      setHeaderAd((prev) => ({ ...prev, imageUrl: url }));
      toast.success('Ad image uploaded');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveHeaderAd = async () => {
    setSaving(true);
    try {
      const result = await updateHeaderLeaderboardAdAction({
        enabled: headerAd.enabled !== false,
        imageUrl: headerAd.imageUrl || '',
        linkUrl: headerAd.linkUrl || '',
        altText: headerAd.altText || 'Advertisement',
      });
      if (result.success) {
        toast.success('Header ad saved');
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Ads</h1>
          <p className="text-muted-foreground">Manage reserved ad slots across the site.</p>
        </div>
        <Button onClick={saveHeaderAd} disabled={saving || uploading} className="bg-accent hover:bg-accent/90">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Header Leaderboard (728×90)</CardTitle>
          <CardDescription>Shown at the top of every page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Enabled</div>
              <div className="text-xs text-muted-foreground">Toggle this ad slot on/off.</div>
            </div>
            <Switch
              checked={headerAd.enabled !== false}
              onCheckedChange={(checked) => setHeaderAd((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Link URL</label>
                <Input
                  value={headerAd.linkUrl || ''}
                  onChange={(e) => setHeaderAd((prev) => ({ ...prev, linkUrl: e.target.value }))}
                  placeholder="https://partner-site.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Alt Text</label>
                <Input
                  value={headerAd.altText || ''}
                  onChange={(e) => setHeaderAd((prev) => ({ ...prev, altText: e.target.value }))}
                  placeholder="Advertisement"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Image</label>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadHeaderImage(file);
                    }}
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="text-xs text-muted-foreground">Upload a 728×90 PNG/JPG for best results.</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Preview</div>
              <div className="border border-border bg-muted/20 p-4 flex items-center justify-center">
                {headerAd.imageUrl ? (
                  <div className="relative w-[728px] max-w-full aspect-[728/90] bg-muted">
                    <Image src={headerAd.imageUrl} alt={headerAd.altText || 'Advertisement'} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-full max-w-[728px] aspect-[728/90] flex items-center justify-center border border-dashed border-border text-xs text-muted-foreground">
                    No image uploaded
                  </div>
                )}
              </div>
              {headerAd.imageUrl && (
                <div className="text-xs text-muted-foreground break-all">
                  {headerAd.imageUrl}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

