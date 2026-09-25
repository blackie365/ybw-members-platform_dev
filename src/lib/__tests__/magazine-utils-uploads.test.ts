import { describe, test, expect } from 'vitest';
import { normalizeImageUrl, fixMagazineImageUrl } from '@/lib/magazine-utils';

const SAMPLES = [
  // 1. Rewritten VPS /uploads/ relative path (Postgres rewrite produces these)
  '/uploads/magazine/apr-may-2026/USF_Splash About_5377.jpg',
  // 2. Same absolute (via NEXT_PUBLIC_SITE_URL returned by buildPublicUrl)
  'https://yorkshirebusinesswoman.co.uk/uploads/ads/header-leaderboard/user_3E4SW36wiEAPrWcGmaSxaNtoimf-1783284939904.jpg',
  // 3. Path with spaces and tricky Apple double-underscore folders
  '/uploads/ads/sidebar-mpu/html5/user_3E4SW36wiEAPrWcGmaSxaNtoimf-1783292320025/__MACOSX/HTML and Static Banners/Static Banners/some image.jpg',
  // 4. gs:// (Firebase legacy)
  'gs://newmembersdirectory130325.firebasestorage.app/magazine/apr-may-2026/USF_Splash About_5377.jpg',
  // 5. Canonical firebasestorage v0 REST (should be no-op)
  'https://firebasestorage.googleapis.com/v0/b/newmembersdirectory130325.firebasestorage.app/o/magazine%2Fapr-may-2026%2FUSF_Splash%20About_5377.jpg?alt=media&token=abc',
  // 6. storage.googleapis.com direct CDN pattern (should rewrite to firebasestorage v0)
  'https://storage.googleapis.com/newmembersdirectory130325.firebasestorage.app/magazine/apr-may-2026/USF_Splash%20About_5377.jpg',
  // 7. Quoted path from JSONB
  '"/uploads/members/2JKiPh1JDwBZyw0EjUj7/avatar-1770214118578-thumb.jpg"',
  // 8. Already has query param
  'https://yorkshirebusinesswoman.co.uk/uploads/x.jpg?someparam=1',
];

describe('normalizeImageUrl + fixMagazineImageUrl /uploads/ regression', () => {
  describe('normalizeImageUrl', () => {
    test.each(SAMPLES.map(s => [s]))('sample %#', (raw) => {
      const out = normalizeImageUrl(raw);
      expect(out).toBeTruthy();
      expect(out).not.toMatch(/^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/uploads/i);
      expect(out).not.toMatch(/^https?:\/\/firebasestorage\.googleapis\.com.*uploads\//i);
    });
  });

  describe('fixMagazineImageUrl', () => {
    test.each(SAMPLES.map(s => [s]))('sample %# (no version)', (raw) => {
      const out = fixMagazineImageUrl(raw);
      expect(out).toBeTruthy();
      expect(out).not.toMatch(/^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/uploads/i);
      expect(out).not.toMatch(/^https?:\/\/firebasestorage\.googleapis\.com.*uploads\//i);
      expect(out).not.toContain('x-ybw-null');
    });

    test('relative /uploads/ path with version param appends ?v= correctly', () => {
      const out = fixMagazineImageUrl('/uploads/magazine/a.jpg', 7);
      expect(out).toEqual('/uploads/magazine/a.jpg?v=7');
    });

    test('absolute /uploads/ URL with version param appends &v= correctly if already has ?', () => {
      const out = fixMagazineImageUrl('https://ybw.co.uk/uploads/x.jpg?foo=1', 'b2');
      expect(out).toEqual('https://ybw.co.uk/uploads/x.jpg?foo=1&v=b2');
    });

    test('gs:// still rewritten to firebasestorage v0', () => {
      const out = fixMagazineImageUrl('gs://bucket.app/file with space.jpg');
      expect(out.startsWith('https://firebasestorage.googleapis.com/v0/b/bucket.app/o/')).toBe(true);
      // Slashes inside path become %2F, while path segment spaces stay %20.
      expect(out).toContain('file%20with%20space.jpg');
    });

    test('storage.googleapis.com/<bucket>/<path> still rewritten to firebasestorage v0 (not /uploads/)', () => {
      const out = fixMagazineImageUrl('https://storage.googleapis.com/bucket.app/path/file.png');
      expect(out.startsWith('https://firebasestorage.googleapis.com/v0/b/bucket.app/o/')).toBe(true);
      expect(out).toContain('path%2Ffile.png');
      expect(out).not.toContain('/uploads/');
    });

    test('magazine-import/<name>.idml/<image> rewritten to flat magazine-import/<image>', () => {
      const out = fixMagazineImageUrl('/uploads/magazine-import/ybw_August_2026_DIGITAL.idml/gill copy 2.jpg');
      expect(out).toEqual('/uploads/magazine-import/gill copy 2.jpg');
    });

    test('magazine-import/<name>.idml/<deep>/<nested>/<image.ext> flattens to basename', () => {
      const out = fixMagazineImageUrl('/uploads/magazine-import/issue.idml/story-library/sub/deep/a.jpg?v=old');
      expect(out).toEqual('/uploads/magazine-import/a.jpg?v=old');
    });

    test('absolute HTTPS URL with idml subdir also flattens and preserves versioning', () => {
      const out = fixMagazineImageUrl(
        'https://yorkshirebusinesswoman.co.uk/uploads/magazine-import/ybw_August_2026_DIGITAL.idml/iStock-483363494.jpg',
        12345,
      );
      expect(out).toEqual(
        'https://yorkshirebusinesswoman.co.uk/uploads/magazine-import/iStock-483363494.jpg?v=12345',
      );
    });

    test('plain magazine-import/<basename> with no .idml/ component is unchanged', () => {
      const out = fixMagazineImageUrl('/uploads/magazine-import/iStock-483363494.jpg', 77);
      expect(out).toEqual('/uploads/magazine-import/iStock-483363494.jpg?v=77');
    });
  });
});
