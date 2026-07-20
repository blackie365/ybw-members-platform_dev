import type { Edition, FlatplanPage } from '../../domain/types';

interface CoverTemplateProps {
  edition: Edition;
  page: FlatplanPage;
  viewModel: Record<string, unknown>;
}

export default function CoverTemplate({ edition, page, viewModel }: CoverTemplateProps) {
  const title = typeof viewModel.title === 'string' ? viewModel.title : edition.title;
  const standfirst =
    typeof viewModel.standfirst === 'string' ? viewModel.standfirst : edition.description || edition.subtitle || '';
  const coverImage =
    typeof viewModel.coverImage === 'string' ? viewModel.coverImage : edition.coverImage;

  return (
    <section className="relative overflow-hidden bg-[#050505] text-white">
      <div className="grid min-h-[80vh] gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-12">
        <div className="flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C9956A]">Digital Edition</p>
            <h1 className="mt-6 max-w-3xl font-serif text-5xl font-medium leading-tight lg:text-7xl">{title}</h1>
            {standfirst ? <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">{standfirst}</p> : null}
          </div>
          <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Page {page.position}</div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="relative aspect-[3/4] w-full max-w-[420px] overflow-hidden border border-white/10 bg-black/20 shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
            {coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImage} alt={title} className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/55 via-black/10 to-white/5" />
          </div>
        </div>
      </div>
    </section>
  );
}
