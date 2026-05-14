"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, Loader2, Mail } from "lucide-react"

export function NewsletterSection() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setIsLoading(true)
      setError("")
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })
        
        if (!res.ok) {
          throw new Error("Failed to subscribe")
        }
        
        setIsSubmitted(true)
      } catch (err) {
        setError("Something went wrong. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <section className="relative overflow-hidden border-t border-border bg-primary text-primary-foreground">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-accent" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-accent" />
      </div>
      
      <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-primary-foreground/20 bg-primary-foreground/5">
            <Mail className="h-6 w-6 text-accent" />
          </div>
          
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
            Stay Informed
          </span>
          <h2 className="mt-4 font-serif text-3xl font-medium lg:text-4xl">
            The Yorkshire Businesswoman Newsletter
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-primary-foreground/70">
            Join thousands of ambitious women who start their week with our curated 
            insights on leadership, finance, and career growth across the region.
          </p>

          {isSubmitted ? (
            <div className="mt-10 flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg">
                <Check className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="font-serif text-xl font-medium">Welcome to the community!</p>
                <p className="mt-1 text-sm text-primary-foreground/70">Check your inbox shortly.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="h-14 w-full border border-primary-foreground/20 bg-transparent px-5 pr-12 text-sm text-primary-foreground placeholder:text-primary-foreground/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all sm:w-80"
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-14 gap-2 bg-accent px-8 text-[11px] font-semibold uppercase tracking-[0.15em] text-accent-foreground shadow-lg transition-all hover:bg-accent/90 hover:shadow-xl disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Subscribe
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
              {error && (
                <p className="mt-3 text-sm text-destructive">{error}</p>
              )}
              <p className="mt-5 text-[11px] text-primary-foreground/50">
                By subscribing, you agree to our Privacy Policy. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
