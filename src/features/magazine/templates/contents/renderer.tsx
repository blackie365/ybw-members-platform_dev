import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageContents } from '../shared';

export default function ContentsTemplate({ viewModel, imageVersion, pages, onNavigateToPage, editionSlug }: TemplateRenderProps) {
  return <PageContents data={viewModel} imageVersion={imageVersion ?? ''} pages={pages} onNavigateToPage={onNavigateToPage} editionSlug={editionSlug} />;
}
