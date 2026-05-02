import Link from 'next/link'
import { Logo } from '@/components/Logo'

export function TopBanner() {
  return (
    <div className="w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <Link href="/" aria-label="Home" className="flex-shrink-0">
          <Logo className="h-10 sm:h-12" />
        </Link>
        <div className="w-full max-w-[728px] h-[90px] bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 text-sm border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
          Advertisement Space (728x90)
        </div>
      </div>
    </div>
  )
}
