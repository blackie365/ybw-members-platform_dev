import slugify from '@sindresorhus/slugify';

const DEFAULT_V2_READER_BASE_URL = 'https://v2.yorkshirebusinesswoman.co.uk';

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
      DEFAULT_V2_READER_BASE_URL,
  );
}

export function getMagazineV2ReaderUrlForIssue(issue: IssueForV2Bridge | null | undefined): string | null {
  const baseUrl = getMagazineV2ReaderBaseUrl();
  if (!baseUrl || !issue?.title) return null;

  return `${baseUrl}/magazine/v2/${slugify(issue.title)}`;
}
