'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { MarketInsight, MarketInsightPoint } from '@/lib/marketInsights';

export default function MarketInsightsWidget({ insight }: { insight: MarketInsight | null }) {
  const [selectedPoint, setSelectedPoint] = useState<MarketInsightPoint | null>(null);

  if (!insight) return null;

  return (
    <>
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-5 shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-500/20 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>

        <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          {insight.title || 'Market Insights'}
        </h3>

        <div className="space-y-4 relative z-10">
          {insight.points && insight.points.length > 0 ? (
            insight.points.map((point, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedPoint(point)}
                className="w-full text-left group flex items-start gap-3 p-3 -mx-3 rounded-xl hover:bg-indigo-100/50 dark:hover:bg-indigo-800/30 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-2 flex-shrink-0 group-hover:scale-150 transition-transform"></div>
                <div>
                  <p className="text-sm font-medium text-indigo-900/90 dark:text-indigo-100/90 leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                    {typeof point === 'string' ? point : point.summary}
                  </p>
                  <span className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1 block font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Read full insight &rarr;
                  </span>
                </div>
              </button>
            ))
          ) : (
            <p className="text-sm text-indigo-700/70 dark:text-indigo-300/70">No insights available for today.</p>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-indigo-200/50 dark:border-indigo-800/50 flex justify-between items-center text-xs text-indigo-600 dark:text-indigo-400">
          <span>Updated Daily</span>
          <time dateTime={insight.createdAt}>
            {format(new Date(insight.createdAt), 'MMM d, yyyy')}
          </time>
        </div>
      </div>

      {/* Modal / Popup */}
      {selectedPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-900/60 backdrop-blur-sm transition-opacity">
          {/* Click away to close */}
          <div className="absolute inset-0" onClick={() => setSelectedPoint(null)}></div>

          <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-zinc-200 dark:ring-white/10 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white pr-8">
                Market Insight
              </h2>
              <button
                onClick={() => setSelectedPoint(null)}
                className="absolute top-5 right-5 p-2 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors focus:outline-none"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">
              <h3 className="text-xl sm:text-2xl font-bold text-indigo-900 dark:text-indigo-400 mb-4 leading-snug">
                {typeof selectedPoint === 'string' ? selectedPoint : selectedPoint.summary}
              </h3>
              
              <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300">
                {typeof selectedPoint !== 'string' && selectedPoint.fullText ? (
                  <p className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
                    {selectedPoint.fullText}
                  </p>
                ) : (
                  <p className="text-base sm:text-lg leading-relaxed italic text-zinc-500 dark:text-zinc-400">
                    No full text available for this insight.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 sm:p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between mt-auto">
              {typeof selectedPoint !== 'string' && selectedPoint.sourceUrl ? (
                <a
                  href={selectedPoint.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1.5"
                >
                  Read original source on {selectedPoint.sourceName || 'external site'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : (
                <div />
              )}
              
              <button
                onClick={() => setSelectedPoint(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
