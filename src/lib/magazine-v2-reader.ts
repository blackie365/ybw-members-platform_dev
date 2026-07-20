import slugify from '@sindresorhus/slugify';

type IssueForV2Bridge = {
  title: string;
};

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  return trimmed.replace(/\/$/, '');
}

export function getMagazineV2ReaderBaseUrl(): string | null {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_V2_READER_BASE_URL ||
      process.env.V2_READER_BASE_URL ||
      null,
  );
}

export function getMagazineV2ReaderUrlForIssue(issue: IssueForV2Bridge | null | undefined): string | null {
  if (!issue?.title) return null;

  const slug = slugify(issue.title);
  const baseUrl = getMagazineV2ReaderBaseUrl();

  return baseUrl ? `${baseUrl}/magazine/v2/${slug}` : `/magazine/v2/${slug}`;
}
