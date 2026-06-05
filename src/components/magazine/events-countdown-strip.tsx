"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, ArrowRight, Clock } from "lucide-react"
import Link from "next/link"

interface CountdownProps {
  targetDate: string
  title: string
  link: string
}

export function EventsCountdownStrip({ targetDate, title, link }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const target = new Date(targetDate).getTime()
      const distance = target - now

      if (distance < 0) {
        clearInterval(timer)
        return
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  if (!mounted) return null

  return (
    <div className="bg-zinc-900 text-white py-3 overflow-hidden border-b border-white/5">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-accent p-2 rounded-full">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-bold leading-none mb-1">Upcoming Event</p>
              <h4 className="text-sm font-serif font-medium leading-none">{title}</h4>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex gap-4">
              {[
                { label: 'Days', value: timeLeft.days },
                { label: 'Hrs', value: timeLeft.hours },
                { label: 'Min', value: timeLeft.minutes },
                { label: 'Sec', value: timeLeft.seconds }
              ].map((item) => (
                <div key={item.label} className="text-center min-w-[40px]">
                  <p className="text-lg font-mono font-bold leading-none">{String(item.value).padStart(2, '0')}</p>
                  <p className="text-[8px] uppercase tracking-widest text-white/40 mt-1">{item.label}</p>
                </div>
              ))}
            </div>

            <Link 
              href={link}
              className="hidden sm:flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
            >
              Get Tickets <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
