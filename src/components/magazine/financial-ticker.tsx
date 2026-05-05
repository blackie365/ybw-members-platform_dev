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
        { "proName": "FOREXCOM:SPXUSD", "title": "S&P 500" },
        { "proName": "FX_IDC:GBPUSD", "title": "GBP/USD" },
        { "proName": "FX_IDC:EURGBP", "title": "EUR/GBP" },
        { "proName": "LSE:BARC", "title": "Barclays" },
        { "proName": "LSE:LLOY", "title": "Lloyds" },
        { "proName": "LSE:SHEL", "title": "Shell" },
        { "proName": "LSE:BP.", "title": "BP" },
        { "proName": "LSE:HSBA", "title": "HSBC" },
        { "proName": "LSE:MKS", "title": "Marks & Spencer" },
        { "proName": "LSE:NXT", "title": "Next" }
      ],
      "showSymbolLogo": true,
      "isTransparent": true,
      "displayMode": "adaptive",
      "colorTheme": theme,
      "locale": "en"
    });
    
    containerRef.current.appendChild(script);
  }, [resolvedTheme]);

  return (
    <div className="border-y border-border bg-[#f7f5f1] dark:bg-zinc-950 py-1">
      <div className="tradingview-widget-container" ref={containerRef}>
        <div className="tradingview-widget-container__widget"></div>
      </div>
    </div>
  );
}