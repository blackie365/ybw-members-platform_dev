import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageBackCover } from '../shared';

export default function BackCoverTemplate({ viewModel, imageVersion }: TemplateRenderProps) {
  return <PageBackCover data={viewModel} imageVersion={imageVersion ?? ''} />;
}
