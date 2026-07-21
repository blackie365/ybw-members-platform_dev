import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageFeatureLeft, PageFeatureRight } from '../shared';

/**
 * Feature template renderer — dispatches to the correct Gen 1 page component
 * based on the flatplan page variant:
 *   left-media  → PageFeatureLeft  (image left, text right)
 *   right-media → PageFeatureRight (text left, image right)
 *   full-bleed  → PageFeatureLeft  with mediaLayout: 'background' (dark overlay)
 */
export default function FeatureTemplate({ page, viewModel, imageVersion }: TemplateRenderProps) {
  const iv = imageVersion ?? '';

  if (page.templateVariant === 'right-media') {
    return <PageFeatureRight data={viewModel} imageVersion={iv} />;
  }

  if (page.templateVariant === 'full-bleed') {
    // PageFeatureLeft renders as a full-bleed dark overlay when mediaLayout === 'background'
    return <PageFeatureLeft data={{ ...viewModel, mediaLayout: 'background' }} imageVersion={iv} />;
  }

  // Default: left-media
  return <PageFeatureLeft data={viewModel} imageVersion={iv} />;
}
