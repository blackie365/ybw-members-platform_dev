import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageNewspaperSpread } from '../shared';

export default function EditorNoteTemplate({ viewModel, imageVersion }: TemplateRenderProps) {
  // Editor's Notes flows as a broadsheet feature — the whole magazine reads as
  // a newspaper. PageNewspaperSpread consumes name/author, kicker, quote,
  // text/intro and featureImage, all of which the editor-note viewModel builds.
  return <PageNewspaperSpread data={viewModel} imageVersion={imageVersion ?? ''} />;
}
