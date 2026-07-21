import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageContents } from '../shared';

export default function ContentsTemplate({ viewModel, imageVersion }: TemplateRenderProps) {
  return <PageContents data={viewModel} imageVersion={imageVersion ?? ''} />;
}
