"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Check if this is a transient HMR/router error
  const isTransientError = 
    error.message?.includes("Cannot read properties of null") ||
    error.message?.includes("fillLazyItemsTillLeafWithHead") ||
    error.message?.includes("router-reducer")

  useEffect(() => {
    // Log the error for debugging (skip transient errors)
    if (!isTransientError) {
      console.error("[v0] App error:", error)
    }
  }, [error, isTransientError])

  useEffect(() => {
    // Auto-retry for transient HMR errors
    if (isTransientError) {
      const timer = setTimeout(() => {
        reset()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isTransientError, reset])

  // Don't show anything for transient errors
  if (isTransientError) {
    return null
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4">
      <h2 className="text-2xl font-serif mb-4">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        We encountered an unexpected error. Please try again.
      </p>
      <button
        onClick={() => reset()}
        className="px-6 py-2 bg-accent text-accent-foreground rounded-md hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  )
}
