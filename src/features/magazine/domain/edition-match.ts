export function normalizeEditionText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getEditionMonthKey(value: string | null | undefined): string {
  const parsed = new Date(String(value || ''));
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function editionRecordsMatch(
  issue: { title?: string; publishDate?: string },
  edition: { title?: string; publishDate?: string },
): boolean {
  const issueTitle = normalizeEditionText(issue.title);
  const editionTitle = normalizeEditionText(edition.title);
  const titlesMatch = Boolean(issueTitle && editionTitle) && (
    issueTitle === editionTitle ||
    issueTitle.includes(editionTitle) ||
    editionTitle.includes(issueTitle)
  );

  const issueMonth = getEditionMonthKey(issue.publishDate);
  const editionMonth = getEditionMonthKey(edition.publishDate);
  const monthMatches = Boolean(issueMonth && editionMonth) && issueMonth === editionMonth;

  return titlesMatch || monthMatches;
}
