import { PageNewspaperSpread } from "@/features/magazine/templates/shared";
import { realStPetersPage, realMediationPage } from "../live-data";

export const metadata = {
  title: "Newspaper Spread — Live Data | Yorkshire BusinessWoman",
};

const stPetersSummary = {
  pageId: "st-peters",
  position: 7,
  title: realStPetersPage.title,
  kicker: "Feature",
  standfirst: realStPetersPage.standfirst.slice(0, 140),
  featureImage: realStPetersPage.featureImage,
};

const mediationSummary = {
  pageId: "mediation",
  position: 2,
  title: "Mediation is the diplomatic alternative to workplace tribunals",
  kicker: "Law",
  standfirst: realMediationPage.standfirst.slice(0, 140),
  featureImage: "",
};

/**
 * Newspaper spread rendered with 100% REAL live content from the Summer 2026
 * read store, using the exact production PageNewspaperSpread component — which
 * is now the DEFAULT for every feature page in the reader. Two pages shown to
 * demonstrate variety: an image-led feature and a no-image article, plus the
 * "More from this edition" cross-linking strip.
 */
export default function NewspaperLivePage() {
  return (
    <div>
      <PageNewspaperSpread
        data={realStPetersPage}
        imageVersion={""}
        siblings={[mediationSummary]}
      />
      <div className="h-px w-full bg-[#a3413a]" />
      <PageNewspaperSpread
        data={realMediationPage}
        imageVersion={""}
        siblings={[stPetersSummary]}
      />
    </div>
  );
}
