"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Star, BookOpen } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function MagazineExperience() {
  const issue = {
    id: "issue-apr-may-2026",
    title: "The Winner of YBW Awards 2026: Lesley Beach",
    coverImage: "https://storage.googleapis.com/newmembersdirectory130325.firebasestorage.app/magazine/apr-may-2026/cover.jpg",
    publishDate: "2026-04-01",
    premiumUrl: "/magazine/issue/issue-apr-may-2026"
  };

  const displayDate = new Date(issue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <section className="bg-primary py-24 md:py-32 text-primary-foreground overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
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
                  <Link href="/magazine/issue/issue-apr-may-2026">
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
            </motion.div>
          </div>

          <div className="lg:w-1/2 relative">
            <motion.div 
              className="relative z-10 aspect-[3/4] max-w-[400px] mx-auto rounded-none overflow-hidden shadow-2xl shadow-black/50 border border-white/10"
              initial={{ opacity: 0, rotateY: 20, rotateX: 5, scale: 0.9 }}
              whileInView={{ opacity: 1, rotateY: 0, rotateX: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <Image 
                src={issue.coverImage}
                alt={issue.title}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </motion.div>
            
            {/* Decorative Elements */}
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-accent/20 blur-3xl rounded-full" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-accent/10 blur-3xl rounded-full" />
            
            <motion.div 
              className="absolute top-1/2 -right-8 -translate-y-1/2 hidden xl:block"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-none">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-[10px] uppercase tracking-widest text-accent font-bold">Interactive Edition</span>
                </div>
                <p className="text-sm font-medium">Real Spreads Sync</p>
                <p className="text-xs text-primary-foreground/50 mt-1">{displayDate}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
