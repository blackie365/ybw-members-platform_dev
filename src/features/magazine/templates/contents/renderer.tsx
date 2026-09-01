import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageNewspaperContents } from '../shared';

export default function ContentsTemplate({ viewModel, imageVersion, editionSlug }: TemplateRenderProps) {
  return <PageNewspaperContents data={viewModel} imageVersion={imageVersion ?? ''} editionSlug={editionSlug} />;
}
