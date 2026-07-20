import slugify from '@sindresorhus/slugify';

type IssueForV2Bridge = {
  title: string;
};

export function getMagazineV2ReaderUrlForIssue(issue: IssueForV2Bridge | null | undefined): string | null {
  if (!issue?.title) return null;

  const slug = slugify(issue.title);
  return `/magazine/v2/${slug}`;
}
