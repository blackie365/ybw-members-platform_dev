"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check } from "lucide-react"

export function NewsletterSection() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setIsSubmitted(true)
    }
  }

  return (
    <section className="border-t border-border bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
            Stay Informed
          </span>
          <h2 className="mt-4 font-serif text-3xl font-medium text-foreground lg:text-4xl">
            The Weekly Briefing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Join 50,000+ ambitious women who start their week with our curated 
            insights on leadership, finance, and career growth.
          </p>

          {isSubmitted ? (
            <div className="mt-8 flex items-center justify-center gap-3 text-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                <Check className="h-5 w-5 text-accent-foreground" />
              </div>
              <span className="font-medium">Welcome to the community!</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="h-12 border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none sm:w-80"
                  required
                />
                <Button
                  type="submit"
                  className="h-12 gap-2 rounded-none bg-primary px-8 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
                >
                  Subscribe
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                By subscribing, you agree to our Privacy Policy. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
