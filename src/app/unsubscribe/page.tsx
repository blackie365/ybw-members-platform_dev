"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/magazine/header";
import { Footer } from "@/components/magazine/footer";

export default function UnsubscribePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage("You have successfully unsubscribed from our newsletter.");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to unsubscribe. Please try again.");
      }
    } catch (err) {
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again later.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <Header />
      <main className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full bg-white p-8 border border-stone-200 shadow-sm text-center">
          <h1 className="font-serif text-3xl text-stone-900 mb-4">Unsubscribe</h1>
          
          {status === "success" ? (
            <div className="text-green-700 bg-green-50 p-4 border border-green-200">
              {message}
            </div>
          ) : (
            <>
              <p className="text-stone-600 mb-6">
                Enter your email address below to unsubscribe from the Yorkshire Businesswoman Daily Digest.
              </p>
              <form onSubmit={handleUnsubscribe} className="space-y-4">
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full"
                />
                {status === "error" && (
                  <p className="text-red-600 text-sm">{message}</p>
                )}
                <Button 
                  type="submit" 
                  disabled={status === "loading"}
                  className="w-full bg-stone-900 hover:bg-stone-800 text-white"
                >
                  {status === "loading" ? "Unsubscribing..." : "Unsubscribe"}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
