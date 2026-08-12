import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageContents } from '../shared';

export default function ContentsTemplate({ viewModel, imageVersion, editionSlug }: TemplateRenderProps) {
  return <PageContents data={viewModel} imageVersion={imageVersion ?? ''} editionSlug={editionSlug} />;
}
