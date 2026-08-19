import type { ComponentType } from "react";
import type { ReaderPage } from "./types";

export interface TemplateRenderProps {
  edition: {
    title: string;
    publishDate: string;
    coverImage: string;
    description: string;
  };
  page: ReaderPage;
  viewModel: Record<string, unknown>;
  imageVersion?: string;
  editionSlug?: string;
}

interface TemplateRegistryEntry {
  render: ComponentType<TemplateRenderProps>;
  buildViewModel: (
    page: ReaderPage,
    edition: TemplateRenderProps["edition"],
  ) => Record<string, unknown>;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

type CRecord = Record<string, unknown>;

function pickFirstImage(c: CRecord | undefined, fallback = ""): string {
  if (!c) return fallback;
  const candidates = [
    c.imageUrl,
    c.featureImage,
    c.image,
    c.heroImage,
    c.mainImage,
    c.primaryImage,
    c.secondaryImage,
    c.topImage,
    c.leftImage,
    c.rightImage,
    c.bottomImage,
    c.coverImage,
    c.logoImage,
    c.partnerLogo,
    c.logo,
  ];
  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  if (Array.isArray(c.imageUrls) && typeof c.imageUrls[0] === "string") return c.imageUrls[0];
  if (Array.isArray(c.images) && typeof c.images[0] === "string") return c.images[0];
  if (Array.isArray(c.gallery) && typeof (c.gallery as any[])[0] === "string") return (c.gallery as any[])[0];
  if (Array.isArray(c.additionalImages) && typeof (c.additionalImages as any[])[0] === "string") return (c.additionalImages as any[])[0];
  return fallback;
}

function pickGallery(c: CRecord | undefined): { src: string }[] {
  if (!c) return [];
  const listEntries = [
    c.imageUrls,
    c.images,
    c.gallery,
    c.additionalImages,
    c.mediaItems,
    c.galleryItems,
    c.logoImages,
  ];
  const seen = new Set<string>();
  const out: { src: string }[] = [];
  const pushOne = (raw: unknown) => {
    let s = "";
    if (typeof raw === "string") s = raw.trim();
    else if (raw && typeof raw === "object") {
      const r = raw as Record<string, unknown>;
      s = String((r.src as string) || (r.image as string) || (r.url as string) || "").trim();
    }
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push({ src: s });
    }
  };
  for (const listEntry of listEntries) {
    if (Array.isArray(listEntry)) {
      for (const item of listEntry) pushOne(item);
    } else if (typeof listEntry === "string") {
      pushOne(listEntry);
    }
  }
  return out;
}

const coverEntry: TemplateRegistryEntry = {
  render: null as any, // lazy loaded
  buildViewModel: (page, edition) => {
    const c = (page.content || {}) as CRecord;
    const main = pickFirstImage(c, edition.coverImage || "");
    const gallery = pickGallery(c);
    if (main) {
      const existed = gallery.some((g) => g.src === main);
      if (!existed) gallery.unshift({ src: main });
    }
    return {
      image: main,
      featureImage: main,
      headline: String(c.title || edition.title || ""),
      subheadline: String(c.standfirst || c.subheadline || c.headline || edition.description || ""),
      date: formatDate(edition.publishDate),
      issue: formatDate(edition.publishDate),
      badge: String(c.kicker || c.section || c.category || ""),
      gallery,
    };
  },
};

const contentsEntry: TemplateRegistryEntry = {
  render: null as any,
  buildViewModel: (page, edition) => {
    const c = (page.content || {}) as CRecord;
    const rawItems = Array.isArray(c.items) ? c.items : (Array.isArray(c.contents) ? c.contents : []);
    const sanitizedItems = rawItems.filter(
      (item: any) => item && typeof item.title === 'string' && String(item.title).trim().length > 0,
    );
    return {
      title: String(c.title || c.headline || "In This Issue"),
      kicker: formatDate(edition.publishDate),
      items: sanitizedItems,
    };
  },
};

const featureEntry: TemplateRegistryEntry = {
  render: null as any,
  buildViewModel: (page) => {
    const c = (page.content || {}) as CRecord;
    const main = pickFirstImage(c, "");
    const gallery = pickGallery(c);
    return {
      title: String(c.title || c.headline || ""),
      kicker: String(c.kicker || c.section || c.category || "Feature"),
      name: String(c.name || c.author || c.byline || ""),
      intro: String(c.standfirst || c.intro || c.subheadline || ""),
      text: String(c.body || c.text || c.article || ""),
      featureImage: main,
      image: main,
      backgroundImage: String(c.backgroundImage || ""),
      videoUrl: String(c.videoUrl || ""),
      quote: String(c.quote || ""),
      pullQuotes: Array.isArray(c.pullQuotes) ? (c.pullQuotes as any[]) : [],
      mediaLayout: String(c.mediaLayout || ""),
      weight: typeof c.weight === "number" ? c.weight : undefined,
      isContinuation: Boolean(c.isContinuation),
      continuationLabel: String(c.continuationLabel || ""),
      snapshotLabel: String(c.snapshotLabel || ""),
      label: String(c.label || c.brand || c.sponsor || ""),
      logo: String(c.logoImage || c.partnerLogo || c.logo || ""),
      gallery,
      stats: [],
    };
  },
};

const editorNoteEntry: TemplateRegistryEntry = {
  render: null as any,
  buildViewModel: (page) => {
    const c = (page.content || {}) as CRecord;
    const main = pickFirstImage(c, "");
    const viewModel: Record<string, unknown> = {
      title: String(c.title || c.headline || "Editor's Note"),
      author: String(c.author || c.name || c.byline || ""),
      quote: String(c.quote || ""),
      text: String(c.body || c.text || c.message || ""),
      intro: String(c.standfirst || c.intro || c.subheadline || ""),
      featureImage: main,
      image: main,
      gallery: pickGallery(c),
      pullQuotes: Array.isArray(c.pullQuotes) ? (c.pullQuotes as any[]) : [],
    };
    delete viewModel.items;
    if (Array.isArray((c as any).items)) {
      try {
        console.warn(
          '[template-registry] editor-note page had stray content.items array; stripped.',
          { pageId: page.id, itemCount: (c as any).items.length },
        );
      } catch {
        /* noop */
      }
    }
    return viewModel;
  },
};

const adEntry: TemplateRegistryEntry = {
  render: null as any,
  buildViewModel: (page) => {
    const c = (page.content || {}) as CRecord;
    const main = pickFirstImage(c, "");
    const viewModel = {
      image: main,
      featureImage: main,
      label: String(c.label || c.brand || c.sponsor || "Advertisement"),
      alt: String(c.title || c.headline || "Advertisement"),
      linkUrl: String(c.ctaHref || c.linkUrl || c.url || ""),
      pdfUrl: String(c.pdfUrl || ""),
      gallery: pickGallery(c),
      logo: String(c.logoImage || c.partnerLogo || c.logo || ""),
    };
    delete (viewModel as any).items;
    return viewModel;
  },
};

const backCoverEntry: TemplateRegistryEntry = {
  render: null as any,
  buildViewModel: (page, edition) => {
    const c = (page.content || {}) as CRecord;
    const main = pickFirstImage(c, edition.coverImage || "");
    const gallery = pickGallery(c);
    const viewModel = {
      title: String(c.title || c.headline || edition.title),
      text: String(c.body || c.text || c.message || edition.description || ""),
      featureImage: main,
      image: main,
      backgroundImage: String(c.backgroundImage || ""),
      videoUrl: String(c.videoUrl || ""),
      kicker: String(c.kicker || c.section || "Until Next Time"),
      cta: String(c.ctaLabel || c.callToAction || "Join the Community"),
      linkUrl: String(c.ctaHref || c.linkUrl || c.url || ""),
      nextIssue: String(c.nextIssue || ""),
      pdfUrl: String(c.pdfUrl || ""),
      gallery,
      socials: [],
    };
    delete (viewModel as any).items;
    return viewModel;
  },
};

const REGISTRY: Record<string, TemplateRegistryEntry> = {
  cover: coverEntry,
  contents: contentsEntry,
  "feature-left": featureEntry,
  "feature-right": featureEntry,
  "feature-full": featureEntry,
  "editor-note": editorNoteEntry,
  ad: adEntry,
  "full-page-ad": adEntry,
  "back-cover": backCoverEntry,
};

export function getTemplateEntry(
  template: string,
): TemplateRegistryEntry | null {
  return REGISTRY[template] ?? null;
}

export function getTemplateViewModel(
  page: ReaderPage,
  edition: TemplateRenderProps["edition"],
): Record<string, unknown> {
  const entry = getTemplateEntry(page.template);
  return entry ? entry.buildViewModel(page, edition) : {};
}

export function getTemplateComponent(
  template: string,
): ComponentType<TemplateRenderProps> | null {
  return REGISTRY[template]?.render ?? null;
}

// Lazy load all template renderers (avoids circular deps)
let _loaded = false;
export function loadTemplateRenderers() {
  if (_loaded) return;
  _loaded = true;

  const CoverTemplate = require("../templates/cover/renderer").default;
  const ContentsTemplate = require("../templates/contents/renderer").default;
  const FeatureTemplate = require("../templates/feature/renderer").default;
  const EditorNoteTemplate =
    require("../templates/editor-note/renderer").default;
  const AdTemplate = require("../templates/ad/renderer").default;
  const BackCoverTemplate = require("../templates/back-cover/renderer").default;

  // Override the render function on each entry
  // The template renderers still expect TemplateRenderProps with the old shape,
  // so we wrap them to adapt
  coverEntry.render = CoverTemplate;
  contentsEntry.render = ContentsTemplate;
  featureEntry.render = FeatureTemplate;
  editorNoteEntry.render = EditorNoteTemplate;
  adEntry.render = AdTemplate;
  backCoverEntry.render = BackCoverTemplate;
}
