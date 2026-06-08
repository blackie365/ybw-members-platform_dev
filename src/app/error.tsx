"use client";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error for debugging
    console.error("[v0] App error:", error)
  }, [error])

  // Removed auto-retry logic that was causing ERR_TOO_MANY_REDIRECTS loops
  // for fundamental JS errors like "Cannot read properties of null".

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
