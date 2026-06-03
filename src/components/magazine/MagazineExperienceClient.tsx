import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Ghost } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MagazineIssue } from "@/lib/magazine-service"

interface MagazineExperienceClientProps {
  latestIssue: MagazineIssue;
}

export function MagazineExperienceClient({ latestIssue }: MagazineExperienceClientProps) {
  const displayDate = new Date(latestIssue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const imageVersion = typeof window !== 'undefined' ? Date.now().toString() : '';

  return (
    <section className="bg-primary py-24 md:py-32 text-primary-foreground overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2">
            <div>
              <Badge variant="outline" className="text-accent border-accent/30 mb-6 px-4 py-1 uppercase tracking-widest text-[10px]">
                New Digital Experience
              </Badge>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-medium mb-8 leading-tight">
                The <span className="italic text-accent">Digital</span> Edition
              </h2>
              <p className="text-primary-foreground/70 text-lg mb-10 leading-relaxed max-w-xl">
                Experience Yorkshire BusinessWoman online. Our interactive digital reader brings the physical magazine experience to your screen with smooth page-turning and high-resolution spreads.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-none h-14 px-8" asChild>
                  <Link href={`/magazine/issue/${latestIssue.id}`}>
                    Launch Digital Edition
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-none h-14 px-8" asChild>
                  <Link href="/new-edition">
                    View Archive
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:w-1/2 relative">
            <div className="relative z-10 aspect-[3/4] max-w-[400px] mx-auto rounded-none overflow-hidden shadow-2xl shadow-black/50 border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={`${latestIssue.coverImage}${imageVersion ? `?v=${imageVersion}` : ''}`}
                alt={latestIssue.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
            
            {/* Decorative Elements */}
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-accent/20 blur-3xl rounded-full" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-accent/10 blur-3xl rounded-full" />
            
            <div className="absolute top-1/2 -right-8 -translate-y-1/2 hidden xl:block">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-none">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-[10px] uppercase tracking-widest text-accent font-bold">Interactive Edition</span>
                </div>
                <p className="text-sm font-medium">Real Spreads Sync</p>
                <p className="text-xs text-primary-foreground/50 mt-1">{displayDate}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
