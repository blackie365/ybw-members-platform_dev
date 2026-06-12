'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ArrowDown, ArrowUp, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAdsConfigAction, updateHeaderLeaderboardAdAction } from '@/app/actions/adsActions';

type HeaderLeaderboardAdItem = {
  id: string;
  enabled?: boolean;
  imageUrl?: string;
  linkUrl?: string;
  altText?: string;
};

type HeaderLeaderboardAdRotation = {
  enabled?: boolean;
  intervalSeconds?: number;
  items?: HeaderLeaderboardAdItem[];
};

type HeaderLeaderboardAd = {
  enabled?: boolean;
  imageUrl?: string;
  linkUrl?: string;
  altText?: string;
  rotation?: HeaderLeaderboardAdRotation;
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
    rotation: {
      enabled: false,
      intervalSeconds: 30,
      items: [],
    },
  });

  const ensureId = (item: Partial<HeaderLeaderboardAdItem>): HeaderLeaderboardAdItem => {
    const id = (item.id as string) || globalThis.crypto?.randomUUID?.() || String(Date.now());
    return {
      id,
      enabled: item.enabled !== false,
      imageUrl: item.imageUrl || '',
      linkUrl: item.linkUrl || '',
      altText: item.altText || '',
    };
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const result = await getAdsConfigAction();
      if (!mounted) return;
      if (result.success) {
        const rotation: HeaderLeaderboardAdRotation = {
          enabled: result.data.headerLeaderboard?.rotation?.enabled === true,
          intervalSeconds: result.data.headerLeaderboard?.rotation?.intervalSeconds || 30,
          items: (result.data.headerLeaderboard?.rotation?.items || []).map((item: any) => ensureId(item)),
        };

        setHeaderAd({
          enabled: result.data.headerLeaderboard?.enabled !== false,
          imageUrl: result.data.headerLeaderboard?.imageUrl || '',
          linkUrl: result.data.headerLeaderboard?.linkUrl || '',
          altText: result.data.headerLeaderboard?.altText || 'Advertisement',
          rotation,
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

  const uploadRotationItemImage = async (itemId: string, file: File) => {
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
      setHeaderAd((prev) => {
        const prevRotation = prev.rotation || { enabled: false, intervalSeconds: 30, items: [] };
        const items = (prevRotation.items || []).map((item) => (item.id === itemId ? { ...item, imageUrl: url } : item));
        return { ...prev, rotation: { ...prevRotation, items } };
      });
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
      const rotation = headerAd.rotation || { enabled: false, intervalSeconds: 30, items: [] };
      const items = (rotation.items || []).map(ensureId);

      const result = await updateHeaderLeaderboardAdAction({
        enabled: headerAd.enabled !== false,
        imageUrl: headerAd.imageUrl || '',
        linkUrl: headerAd.linkUrl || '',
        altText: headerAd.altText || 'Advertisement',
        rotation: {
          enabled: rotation.enabled === true,
          intervalSeconds: rotation.intervalSeconds || 30,
          items,
        },
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

  const rotation = headerAd.rotation || { enabled: false, intervalSeconds: 30, items: [] };
  const rotationItems = rotation.items || [];

  const updateRotationItem = (itemId: string, patch: Partial<HeaderLeaderboardAdItem>) => {
    setHeaderAd((prev) => {
      const prevRotation = prev.rotation || { enabled: false, intervalSeconds: 30, items: [] };
      const items = (prevRotation.items || []).map((item) => (item.id === itemId ? { ...item, ...patch } : item));
      return { ...prev, rotation: { ...prevRotation, items } };
    });
  };

  const addRotationItem = () => {
    const newItem = ensureId({ enabled: true, imageUrl: '', linkUrl: '', altText: '' });
    setHeaderAd((prev) => {
      const prevRotation = prev.rotation || { enabled: false, intervalSeconds: 30, items: [] };
      return { ...prev, rotation: { ...prevRotation, items: [...(prevRotation.items || []), newItem] } };
    });
  };

  const removeRotationItem = (itemId: string) => {
    setHeaderAd((prev) => {
      const prevRotation = prev.rotation || { enabled: false, intervalSeconds: 30, items: [] };
      const items = (prevRotation.items || []).filter((item) => item.id !== itemId);
      return { ...prev, rotation: { ...prevRotation, items } };
    });
  };

  const moveRotationItem = (itemId: string, direction: -1 | 1) => {
    setHeaderAd((prev) => {
      const prevRotation = prev.rotation || { enabled: false, intervalSeconds: 30, items: [] };
      const items = [...(prevRotation.items || [])];
      const index = items.findIndex((item) => item.id === itemId);
      if (index === -1) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= items.length) return prev;
      const temp = items[index];
      items[index] = items[nextIndex];
      items[nextIndex] = temp;
      return { ...prev, rotation: { ...prevRotation, items } };
    });
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
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Rotation</div>
                  <div className="text-xs text-muted-foreground">Rotate between multiple ads.</div>
                </div>
                <Switch
                  checked={rotation.enabled === true}
                  onCheckedChange={(checked) =>
                    setHeaderAd((prev) => ({
                      ...prev,
                      rotation: { ...(prev.rotation || {}), enabled: checked, intervalSeconds: prev.rotation?.intervalSeconds || 30, items: prev.rotation?.items || [] },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Rotation Interval (seconds)</label>
                <Input
                  type="number"
                  min={5}
                  max={3600}
                  value={rotation.intervalSeconds || 30}
                  onChange={(e) =>
                    setHeaderAd((prev) => ({
                      ...prev,
                      rotation: { ...(prev.rotation || {}), intervalSeconds: Number(e.target.value || 30) },
                    }))
                  }
                />
              </div>

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

          <div className="border-t border-border pt-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Rotation Items</div>
                <div className="text-xs text-muted-foreground">Order matters. Only enabled items with an image will rotate.</div>
              </div>
              <Button variant="secondary" onClick={addRotationItem} disabled={uploading}>
                Add Ad
              </Button>
            </div>

            {rotationItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">No rotation items yet.</div>
            ) : (
              <div className="space-y-4">
                {rotationItems.map((item, index) => (
                  <div key={item.id} className="rounded-md border border-border p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Switch checked={item.enabled !== false} onCheckedChange={(checked) => updateRotationItem(item.id, { enabled: checked })} />
                        <div className="text-sm font-medium">Ad {index + 1}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => moveRotationItem(item.id, -1)} disabled={index === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => moveRotationItem(item.id, 1)} disabled={index === rotationItems.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeRotationItem(item.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Link URL</label>
                          <Input value={item.linkUrl || ''} onChange={(e) => updateRotationItem(item.id, { linkUrl: e.target.value })} placeholder="https://partner-site.com" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Alt Text</label>
                          <Input value={item.altText || ''} onChange={(e) => updateRotationItem(item.id, { altText: e.target.value })} placeholder={headerAd.altText || 'Advertisement'} />
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
                                if (file) uploadRotationItemImage(item.id, file);
                              }}
                            />
                            {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Preview</div>
                        <div className="border border-border bg-muted/20 p-4 flex items-center justify-center">
                          {item.imageUrl ? (
                            <div className="relative w-[728px] max-w-full aspect-[728/90] bg-muted">
                              <Image src={item.imageUrl} alt={item.altText || headerAd.altText || 'Advertisement'} fill className="object-cover" />
                            </div>
                          ) : (
                            <div className="w-full max-w-[728px] aspect-[728/90] flex items-center justify-center border border-dashed border-border text-xs text-muted-foreground">
                              No image uploaded
                            </div>
                          )}
                        </div>
                        {item.imageUrl && <div className="text-xs text-muted-foreground break-all">{item.imageUrl}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
