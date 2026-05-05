"use client"

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

export function FinancialTicker() {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear previous script if any to prevent duplicates on theme change
    containerRef.current.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    
    const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

    script.innerHTML = JSON.stringify({
      "symbols": [
        { "proName": "FOREXCOM:UKXGBP", "title": "FTSE 100" },
        { "proName": "OANDA:UK250GBP", "title": "FTSE 250" },
        { "proName": "FX_IDC:GBPUSD", "title": "GBP/USD" },
        { "proName": "FX_IDC:GBPEUR", "title": "GBP/EUR" },
        { "proName": "LSE:BARC", "title": "Barclays" },
        { "proName": "LSE:LLOY", "title": "Lloyds" },
        { "proName": "LSE:TSCO", "title": "Tesco" },
        { "proName": "LSE:SBRY", "title": "Sainsbury's" },
        { "proName": "LSE:NWG", "title": "NatWest" },
        { "proName": "LSE:MKS", "title": "Marks & Spencer" },
        { "proName": "LSE:SHEL", "title": "Shell" },
        { "proName": "LSE:BP.", "title": "BP" }
      ],
      "showSymbolLogo": false,
      "isTransparent": true,
      "displayMode": "compact",
      "colorTheme": theme,
      "locale": "en",
      "largeChartUrl": ""
    });
    
    containerRef.current.appendChild(script);
  }, [resolvedTheme]);

  return (
    <div className="border-y border-border bg-[#f7f5f1] dark:bg-zinc-950 py-0.5 text-xs">
      <div className="tradingview-widget-container" ref={containerRef}>
        <div className="tradingview-widget-container__widget" style={{ height: "32px" }}></div>
      </div>
    </div>
  );
}