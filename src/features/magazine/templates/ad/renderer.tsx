import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageFullPageAd } from '../shared';

export default function AdTemplate({ viewModel, imageVersion }: TemplateRenderProps) {
  return <PageFullPageAd data={viewModel} imageVersion={imageVersion ?? ''} />;
}
