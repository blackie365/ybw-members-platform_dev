import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageContents } from '../shared';

export default function ContentsTemplate({ viewModel, imageVersion, pages, onNavigateToPage }: TemplateRenderProps) {
  return <PageContents data={viewModel} imageVersion={imageVersion ?? ''} pages={pages} onNavigateToPage={onNavigateToPage} />;
}
