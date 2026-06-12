'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ArrowDown, ArrowUp, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAdsConfigAction, updateAdSlotAction } from '@/app/actions/adsActions';

type AdItem = {
  id: string;
  enabled?: boolean;
  imageUrl?: string;
  linkUrl?: string;
  altText?: string;
};

type AdRotation = {
  enabled?: boolean;
  intervalSeconds?: number;
  items?: AdItem[];
};

type AdSlotConfig = {
  enabled?: boolean;
  imageUrl?: string;
  linkUrl?: string;
  altText?: string;
  rotation?: AdRotation;
};

export default function AdsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const defaultSlot: AdSlotConfig = {
    enabled: true,
    imageUrl: '',
    linkUrl: '',
    altText: 'Advertisement',
    rotation: { enabled: false, intervalSeconds: 30, items: [] },
  };

  const [ads, setAds] = useState<Record<'headerLeaderboard' | 'sidebarMpu' | 'midArticle', AdSlotConfig>>({
    headerLeaderboard: { ...defaultSlot },
    sidebarMpu: { ...defaultSlot },
    midArticle: { ...defaultSlot },
  });

  const ensureId = (item: Partial<AdItem>): AdItem => {
    const id = (item.id as string) || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
      id,
      enabled: item.enabled !== false,
      imageUrl: item.imageUrl || '',
      linkUrl: item.linkUrl || '',
      altText: item.altText || '',
    };
  };

  const slotDefs: Array<{
    key: 'headerLeaderboard' | 'sidebarMpu' | 'midArticle';
    title: string;
    description: string;
    folder: string;
    aspectClass: string;
    maxWidthClass: string;
  }> = [
    {
      key: 'headerLeaderboard',
      title: 'Header Leaderboard (728×90)',
      description: 'Shown at the top of every page.',
      folder: 'ads/header-leaderboard',
      aspectClass: 'aspect-[728/90]',
      maxWidthClass: 'max-w-[728px]',
    },
    {
      key: 'sidebarMpu',
      title: 'Sidebar MPU (300×250)',
      description: 'Shown in the right-hand column on articles.',
      folder: 'ads/sidebar-mpu',
      aspectClass: 'aspect-[6/5]',
      maxWidthClass: 'max-w-[300px]',
    },
    {
      key: 'midArticle',
      title: 'Mid-Article (728×90)',
      description: 'Shown inside an article body section.',
      folder: 'ads/mid-article',
      aspectClass: 'aspect-[728/90]',
      maxWidthClass: 'max-w-[728px]',
    },
  ];

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const result = await getAdsConfigAction();
      if (!mounted) return;
      if (result.success) {
        const loadSlot = (raw: any): AdSlotConfig => {
          const rotation: AdRotation = {
            enabled: raw?.rotation?.enabled === true,
            intervalSeconds: raw?.rotation?.intervalSeconds || 30,
            items: (raw?.rotation?.items || []).map((item: any) => ensureId(item)),
          };

          return {
            enabled: raw?.enabled !== false,
            imageUrl: raw?.imageUrl || '',
            linkUrl: raw?.linkUrl || '',
            altText: raw?.altText || 'Advertisement',
            rotation,
          };
        };

        setAds({
          headerLeaderboard: loadSlot(result.data.headerLeaderboard),
          sidebarMpu: loadSlot((result.data as any).sidebarMpu),
          midArticle: loadSlot((result.data as any).midArticle),
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

  const uploadSlotImage = async (slotKey: 'headerLeaderboard' | 'sidebarMpu' | 'midArticle', folder: string, file: File) => {
    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('folder', folder);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadRes.ok) {
        const uploadData = await uploadRes.json().catch(() => ({}));
        throw new Error(uploadData.error || 'Failed to upload image');
      }

      const { url } = await uploadRes.json();
      setAds((prev) => ({ ...prev, [slotKey]: { ...prev[slotKey], imageUrl: url } }));
      toast.success('Ad image uploaded');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const uploadRotationItemImage = async (
    slotKey: 'headerLeaderboard' | 'sidebarMpu' | 'midArticle',
    folder: string,
    itemId: string,
    file: File
  ) => {
    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('folder', folder);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadRes.ok) {
        const uploadData = await uploadRes.json().catch(() => ({}));
        throw new Error(uploadData.error || 'Failed to upload image');
      }

      const { url } = await uploadRes.json();
      setAds((prev) => {
        const prevSlot = prev[slotKey];
        const prevRotation = prevSlot.rotation || { enabled: false, intervalSeconds: 30, items: [] };
        const items = (prevRotation.items || []).map((item) => (item.id === itemId ? { ...item, imageUrl: url } : item));
        return { ...prev, [slotKey]: { ...prevSlot, rotation: { ...prevRotation, items } } };
      });
      toast.success('Ad image uploaded');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const slotKey of ['headerLeaderboard', 'sidebarMpu', 'midArticle'] as const) {
        const slot = ads[slotKey];
        const rotation = slot.rotation || { enabled: false, intervalSeconds: 30, items: [] };
        const items = (rotation.items || []).map(ensureId);

        const result = await updateAdSlotAction(slotKey, {
          enabled: slot.enabled !== false,
          imageUrl: slot.imageUrl || '',
          linkUrl: slot.linkUrl || '',
          altText: slot.altText || 'Advertisement',
          rotation: {
            enabled: rotation.enabled === true,
            intervalSeconds: rotation.intervalSeconds || 30,
            items,
          },
        });

        if (!result.success) {
          toast.error(result.error);
          return;
        }
      }

      toast.success('Ads saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateSlot = (slotKey: 'headerLeaderboard' | 'sidebarMpu' | 'midArticle', patch: Partial<AdSlotConfig>) => {
    setAds((prev) => ({ ...prev, [slotKey]: { ...prev[slotKey], ...patch } }));
  };

  const updateRotation = (slotKey: 'headerLeaderboard' | 'sidebarMpu' | 'midArticle', patch: Partial<AdRotation>) => {
    setAds((prev) => {
      const prevSlot = prev[slotKey];
      const rotation = prevSlot.rotation || { enabled: false, intervalSeconds: 30, items: [] };
      return { ...prev, [slotKey]: { ...prevSlot, rotation: { ...rotation, ...patch } } };
    });
  };

  const updateRotationItem = (
    slotKey: 'headerLeaderboard' | 'sidebarMpu' | 'midArticle',
    itemId: string,
    patch: Partial<AdItem>
  ) => {
    setAds((prev) => {
      const prevSlot = prev[slotKey];
      const prevRotation = prevSlot.rotation || { enabled: false, intervalSeconds: 30, items: [] };
      const items = (prevRotation.items || []).map((item) => (item.id === itemId ? { ...item, ...patch } : item));
      return { ...prev, [slotKey]: { ...prevSlot, rotation: { ...prevRotation, items } } };
    });
  };

  const addRotationItem = (slotKey: 'headerLeaderboard' | 'sidebarMpu' | 'midArticle') => {
    const newItem = ensureId({ enabled: true, imageUrl: '', linkUrl: '', altText: '' });
    setAds((prev) => {
      const prevSlot = prev[slotKey];
      const prevRotation = prevSlot.rotation || { enabled: false, intervalSeconds: 30, items: [] };
      return { ...prev, [slotKey]: { ...prevSlot, rotation: { ...prevRotation, items: [...(prevRotation.items || []), newItem] } } };
    });
  };

  const removeRotationItem = (slotKey: 'headerLeaderboard' | 'sidebarMpu' | 'midArticle', itemId: string) => {
    setAds((prev) => {
      const prevSlot = prev[slotKey];
      const prevRotation = prevSlot.rotation || { enabled: false, intervalSeconds: 30, items: [] };
      const items = (prevRotation.items || []).filter((item) => item.id !== itemId);
      return { ...prev, [slotKey]: { ...prevSlot, rotation: { ...prevRotation, items } } };
    });
  };

  const moveRotationItem = (slotKey: 'headerLeaderboard' | 'sidebarMpu' | 'midArticle', itemId: string, direction: -1 | 1) => {
    setAds((prev) => {
      const prevSlot = prev[slotKey];
      const prevRotation = prevSlot.rotation || { enabled: false, intervalSeconds: 30, items: [] };
      const items = [...(prevRotation.items || [])];
      const index = items.findIndex((item) => item.id === itemId);
      if (index === -1) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= items.length) return prev;
      const temp = items[index];
      items[index] = items[nextIndex];
      items[nextIndex] = temp;
      return { ...prev, [slotKey]: { ...prevSlot, rotation: { ...prevRotation, items } } };
    });
  };

  const renderSlot = (def: (typeof slotDefs)[number]) => {
    const slot = ads[def.key];
    const rotation = slot.rotation || { enabled: false, intervalSeconds: 30, items: [] };
    const rotationItems = rotation.items || [];

    return (
      <Card key={def.key}>
        <CardHeader>
          <CardTitle className="text-lg">{def.title}</CardTitle>
          <CardDescription>{def.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Enabled</div>
              <div className="text-xs text-muted-foreground">Toggle this ad slot on/off.</div>
            </div>
            <Switch checked={slot.enabled !== false} onCheckedChange={(checked) => updateSlot(def.key, { enabled: checked })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Rotation</div>
                  <div className="text-xs text-muted-foreground">Rotate between multiple ads.</div>
                </div>
                <Switch checked={rotation.enabled === true} onCheckedChange={(checked) => updateRotation(def.key, { enabled: checked })} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Rotation Interval (seconds)</label>
                <Input
                  type="number"
                  min={5}
                  max={3600}
                  value={rotation.intervalSeconds || 30}
                  onChange={(e) => updateRotation(def.key, { intervalSeconds: Number(e.target.value || 30) })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Link URL</label>
                <Input value={slot.linkUrl || ''} onChange={(e) => updateSlot(def.key, { linkUrl: e.target.value })} placeholder="https://partner-site.com" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Alt Text</label>
                <Input value={slot.altText || ''} onChange={(e) => updateSlot(def.key, { altText: e.target.value })} placeholder="Advertisement" />
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
                      if (file) uploadSlotImage(def.key, def.folder, file);
                    }}
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Preview</div>
              <div className="border border-border bg-muted/20 p-4 flex items-center justify-center">
                {slot.imageUrl ? (
                  <div className={`relative w-full ${def.maxWidthClass} ${def.aspectClass} bg-muted`}>
                    <Image src={slot.imageUrl} alt={slot.altText || 'Advertisement'} fill className="object-cover" />
                  </div>
                ) : (
                  <div className={`w-full ${def.maxWidthClass} ${def.aspectClass} flex items-center justify-center border border-dashed border-border text-xs text-muted-foreground`}>
                    No image uploaded
                  </div>
                )}
              </div>
              {slot.imageUrl && <div className="text-xs text-muted-foreground break-all">{slot.imageUrl}</div>}
            </div>
          </div>

          <div className="border-t border-border pt-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Rotation Items</div>
                <div className="text-xs text-muted-foreground">Order matters. Only enabled items with an image will rotate.</div>
              </div>
              <Button variant="secondary" onClick={() => addRotationItem(def.key)} disabled={uploading}>
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
                        <Switch checked={item.enabled !== false} onCheckedChange={(checked) => updateRotationItem(def.key, item.id, { enabled: checked })} />
                        <div className="text-sm font-medium">Ad {index + 1}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => moveRotationItem(def.key, item.id, -1)} disabled={index === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => moveRotationItem(def.key, item.id, 1)} disabled={index === rotationItems.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRotationItem(def.key, item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Link URL</label>
                          <Input
                            value={item.linkUrl || ''}
                            onChange={(e) => updateRotationItem(def.key, item.id, { linkUrl: e.target.value })}
                            placeholder="https://partner-site.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Alt Text</label>
                          <Input
                            value={item.altText || ''}
                            onChange={(e) => updateRotationItem(def.key, item.id, { altText: e.target.value })}
                            placeholder={slot.altText || 'Advertisement'}
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
                                if (file) uploadRotationItemImage(def.key, def.folder, item.id, file);
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
                            <div className={`relative w-full ${def.maxWidthClass} ${def.aspectClass} bg-muted`}>
                              <Image src={item.imageUrl} alt={item.altText || slot.altText || 'Advertisement'} fill className="object-cover" />
                            </div>
                          ) : (
                            <div className={`w-full ${def.maxWidthClass} ${def.aspectClass} flex items-center justify-center border border-dashed border-border text-xs text-muted-foreground`}>
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
    );
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
        <Button onClick={saveAll} disabled={saving || uploading} className="bg-accent hover:bg-accent/90">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>

      {slotDefs.map(renderSlot)}
    </div>
  );
}
