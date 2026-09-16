import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageAds } from '../shared';

export default function AdsTemplate({ viewModel, imageVersion }: TemplateRenderProps) {
  return <PageAds data={viewModel} imageVersion={imageVersion ?? ''} />;
}