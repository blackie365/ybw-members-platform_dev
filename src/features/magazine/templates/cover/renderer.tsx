import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageNewspaperCover } from '../shared';

export default function CoverTemplate({ viewModel, imageVersion }: TemplateRenderProps) {
  return <PageNewspaperCover data={viewModel} imageVersion={imageVersion ?? ''} />;
}
