import { PageNewspaperSpread } from "@/features/magazine/templates/shared";
import { realStPetersPage, realMediationPage } from "../live-data";

export const metadata = {
  title: "Newspaper Spread — Live Data | Yorkshire BusinessWoman",
};

/**
 * Newspaper spread rendered with 100% REAL live content from the Summer 2026
 * read store, using the exact production PageNewspaperSpread component — which
 * is now the DEFAULT for every feature page in the reader. Two pages shown to
 * demonstrate variety: an image-led feature and a no-image article.
 */
export default function NewspaperLivePage() {
  return (
    <div>
      <PageNewspaperSpread data={realStPetersPage} imageVersion={""} />
      <div className="h-px w-full bg-[#a3413a]" />
      <PageNewspaperSpread data={realMediationPage} imageVersion={""} />
    </div>
  );
}
