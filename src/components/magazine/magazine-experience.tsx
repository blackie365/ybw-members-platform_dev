import { listReaderEditions } from '@/features/magazine/server/simple-reader';
import { MagazineExperienceClient } from "./MagazineExperienceClient";

export async function MagazineExperience() {
  const editions = await listReaderEditions(1).catch(() => []);
  const latestIssue = editions[0] ?? null;

  if (!latestIssue) return null;

  return <MagazineExperienceClient latestIssue={latestIssue} />;
}
