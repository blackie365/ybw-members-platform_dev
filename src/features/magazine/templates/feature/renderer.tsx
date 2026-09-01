import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageNewspaperSpread, PageFeatureLeft } from '../shared';

export default function FeatureTemplate({ page, viewModel, imageVersion }: TemplateRenderProps) {
  const iv = imageVersion ?? '';

  // The newspaper broadsheet layout is now the DEFAULT style for every feature
  // page. An explicit mediaLayout:'background' opts back into the legacy
  // full-bleed background treatment on a per-page basis.
  const layout = String((viewModel as any)?.mediaLayout || '').trim();

  if (layout === 'background') {
    return <PageFeatureLeft data={{ ...viewModel, mediaLayout: 'background' }} imageVersion={iv} />;
  }

  return <PageNewspaperSpread data={viewModel} imageVersion={iv} />;
}
