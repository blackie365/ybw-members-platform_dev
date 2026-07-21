import type { TemplateRenderProps } from '../../domain/template-registry';
import { PageEditorial } from '../shared';

export default function EditorNoteTemplate({ viewModel, imageVersion }: TemplateRenderProps) {
  return <PageEditorial data={viewModel} imageVersion={imageVersion ?? ''} />;
}
