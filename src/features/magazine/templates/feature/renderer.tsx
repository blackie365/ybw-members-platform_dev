import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageFeatureLeft, PageFeatureRight } from '../shared';

export default function FeatureTemplate({ page, viewModel, imageVersion }: TemplateRenderProps) {
  const iv = imageVersion ?? '';

  if (page.template === 'feature-right') {
    return <PageFeatureRight data={viewModel} imageVersion={iv} />;
  }

  if (page.template === 'feature-full') {
    return <PageFeatureLeft data={{ ...viewModel, mediaLayout: 'background' }} imageVersion={iv} />;
  }

  return <PageFeatureLeft data={viewModel} imageVersion={iv} />;
}
