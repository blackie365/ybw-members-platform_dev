import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageNewspaperCover } from '../shared';

export default function CoverTemplate({ viewModel, imageVersion, editionSlug, siblings }: TemplateRenderProps) {
  return (
    <PageNewspaperCover
      data={viewModel}
      imageVersion={imageVersion ?? ''}
      editionSlug={editionSlug}
      siblings={siblings}
    />
  );
}