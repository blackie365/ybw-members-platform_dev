"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"

const marketData = [
  { symbol: "S&P 500", value: "5,234.12", change: "+0.8%", trend: "up" },
  { symbol: "NASDAQ", value: "16,892.45", change: "+1.2%", trend: "up" },
  { symbol: "DOW", value: "39,156.78", change: "-0.3%", trend: "down" },
  { symbol: "FTSE 100", value: "8,234.56", change: "+0.5%", trend: "up" },
  { symbol: "DAX", value: "18,567.89", change: "0.0%", trend: "neutral" },
]

export function NewsTicker() {
  return (
    <div className="border-y border-border bg-secondary/50">
      <div className="mx-auto flex max-w-7xl items-center gap-8 overflow-x-auto px-4 py-3 lg:px-8">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">
          Markets
        </span>
        <div className="flex items-center gap-6">
          {marketData.map((item) => (
            <div key={item.symbol} className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-medium text-foreground">
                {item.symbol}
              </span>
              <span className="text-xs text-muted-foreground">{item.value}</span>
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  item.trend === "up"
                    ? "text-emerald-600"
                    : item.trend === "down"
                    ? "text-red-500"
                    : "text-muted-foreground"
                }`}
              >
                {item.trend === "up" && <TrendingUp className="h-3 w-3" />}
                {item.trend === "down" && <TrendingDown className="h-3 w-3" />}
                {item.trend === "neutral" && <Minus className="h-3 w-3" />}
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
