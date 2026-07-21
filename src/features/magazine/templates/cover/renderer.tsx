import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageCover } from '../shared';

export default function CoverTemplate({ viewModel, imageVersion }: TemplateRenderProps) {
  return <PageCover data={viewModel} imageVersion={imageVersion ?? ''} />;
}
