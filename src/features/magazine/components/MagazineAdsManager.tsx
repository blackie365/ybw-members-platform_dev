'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { MagazineAdRecord } from '@/features/magazine/domain/magazine-ads';
import {
  getMagazineAdsAction,
  saveMagazineAdsAction,
  importSiteAdsToMagazineAction,
} from '@/app/actions/magazine/magazine-ads-actions';

export default function MagazineAdsManager() {
  const [ads, setAds] = useState<MagazineAdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getMagazineAdsAction();
    if (res.success) setAds(res.data);
    else toast.error(res.error || 'Failed to load magazine ads');
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    const res = await saveMagazineAdsAction(ads);
    if (res.success) {
      setAds(res.data);
      toast.success('Magazine ads saved');
    } else {
      toast.error(res.error || 'Save failed');
    }
    setSaving(false);
  };

  const handleImport = async () => {
    setImporting(true);
    const res = await importSiteAdsToMagazineAction();
    if (res.success) {
      setAds(res.data);
      toast.success(`Imported ${res.data.length} ad(s) from the site Ads tab`);
    } else {
      toast.error(res.error || 'Import failed');
    }
    setImporting(false);
  };

  const toggleEnabled = (id: string) => {
    setAds((prev) =>
      prev.map((ad) => (ad.id === id ? { ...ad, enabled: ad.enabled === false ? true : false } : ad)),
    );
  };

  const updateLabel = (id: string, label: string) => {
    setAds((prev) => prev.map((ad) => (ad.id === id ? { ...ad, label } : ad)));
  };

  const removeAd = (id: string) => {
    setAds((prev) => prev.filter((ad) => ad.id !== id));
  };

  const moveAd = (id: string, dir: -1 | 1) => {
    setAds((prev) => {
      const idx = prev.findIndex((a) => a.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const tmp = { ...next[idx], position: target };
      next[idx] = { ...next[target], position: idx };
      next[target] = tmp;
      return next;
    });
  };

  return (
    <Card className="border-zinc-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-serif">Magazine Spread Ads</CardTitle>
            <CardDescription>
              Ads shown in the newspaper-style spread rails. Imported creatives cycle across spreads
              that have a pull-quote rail.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={importing || saving}
              onClick={handleImport}
              className="gap-1.5"
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Import from Site Ads
            </Button>
            <Button
              size="sm"
              disabled={saving || importing || loading}
              onClick={handleSave}
              className="bg-accent hover:bg-accent/90 gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : ads.length === 0 ? (
          <div className="py-8 text-center border border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground italic">
              No magazine ads configured yet. Use &quot;Import from Site Ads&quot; to pull the
              Quilter Cheviot ad from the Ads tab, or add creatives manually.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {ads.map((ad, index) => (
              <div
                key={ad.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3"
              >
                <Switch
                  checked={ad.enabled !== false}
                  onCheckedChange={() => toggleEnabled(ad.id)}
                />
                {ad.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ad.image}
                    alt={ad.alt || ad.label || 'Ad'}
                    className="h-10 w-24 rounded border object-cover bg-muted shrink-0"
                  />
                ) : (
                  <div className="h-10 w-24 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                    no image
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Input
                    value={ad.label || ''}
                    onChange={(e) => updateLabel(ad.id, e.target.value)}
                    className="h-8 text-sm border-0 shadow-none p-0 bg-transparent"
                    placeholder="Ad label"
                  />
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {ad.id}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => moveAd(ad.id, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === ads.length - 1}
                    onClick={() => moveAd(ad.id, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:text-destructive"
                    onClick={() => removeAd(ad.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}