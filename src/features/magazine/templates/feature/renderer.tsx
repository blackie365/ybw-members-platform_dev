import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageNewspaperSpread } from '../shared';

export default function FeatureTemplate({ viewModel, siblings, imageVersion }: TemplateRenderProps) {
  const iv = imageVersion ?? '';

  // The newspaper broadsheet layout is the DEFAULT for every feature page in
  // the reader. mediaLayout is intentionally ignored here — imported IDML
  // content carries mediaLayout:'background' on most pages, and the whole
  // magazine should read as a newspaper. The legacy full-bleed background
  // renderer (PageFeatureLeft) is still exported for bespoke pages.
  return <PageNewspaperSpread data={viewModel} imageVersion={iv} siblings={siblings} />;
}
