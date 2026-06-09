'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { MagazinePage, MagazineIssue } from '@/lib/magazine-service';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';
import styles from './reader.module.css';

interface DigitalReaderClientProps {
  issue: MagazineIssue;
  pages: MagazinePage[];
  issueId: string;
}

export default function DigitalReaderClient({ issue, pages, issueId }: DigitalReaderClientProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [imageVersion, setImageVersion] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImageVersion(Date.now().toString());
  }, []);

  const goToPage = useCallback(
    (index: number) => {
      if (index === currentPage || isTransitioning) return;
      const dir = index > currentPage ? 'left' : 'right';
      setSlideDir(dir);
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentPage(index);
        setIsTransitioning(false);
        setSlideDir(null);
        setIsTocOpen(false);
      }, 320);
    },
    [currentPage, isTransitioning]
  );

  const nextPage = useCallback(() => {
    if (currentPage < pages.length - 1) goToPage(currentPage + 1);
  }, [currentPage, pages.length, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'Escape') setIsTocOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [nextPage, prevPage]);

  const progress = ((currentPage + 1) / pages.length) * 100;
  const page = pages[currentPage];

  const pageSlideClass = isTransitioning
    ? slideDir === 'left'
      ? styles.slideOutLeft
      : styles.slideOutRight
    : styles.slideIn;

  return (
    <div ref={rootRef} className={styles.root}>
      {/* ── CSS Variables ── */}
      <style>{`
        :root {
          --dr-bg: #0d0b0a;
          --dr-surface: #141210;
          --dr-border: rgba(255,255,255,0.07);
          --dr-accent: #8b1f3f;
          --dr-accent-dim: rgba(139,31,63,0.18);
          --dr-text: #e8e0d8;
          --dr-muted: #6b6460;
          --dr-header-h: 56px;
          --dr-footer-h: 64px;
        }
      `}</style>

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/new-edition" className={styles.closeBtn} title="Back to archive">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </Link>
          <div className={styles.headerDivider} />
          <div className={styles.brandMark}>
            <span className={styles.brandDot} />
            <span className={styles.brandName}>YBW</span>
            <span className={styles.brandSep}>·</span>
            <span className={styles.brandEdition}>
              {(page?.content as any)?.date || issue?.title || 'Digital Edition'}
            </span>
          </div>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.progressPill}>
            <span className={styles.progressCurrent}>{currentPage + 1}</span>
            <span className={styles.progressSlash}>/</span>
            <span className={styles.progressTotal}>{pages.length}</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            className={styles.iconBtn}
            onClick={() => setIsTocOpen(!isTocOpen)}
            title="Table of contents"
            aria-label="Toggle table of contents"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── PROGRESS BAR ── */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      {/* ── MAIN STAGE ── */}
      <main className={styles.stage}>
        {/* Ambient glow */}
        <div className={styles.ambientGlow} />

        {/* Prev arrow */}
        <button
          className={`${styles.navArrow} ${styles.navArrowLeft} ${currentPage === 0 ? styles.navArrowDisabled : ''}`}
          onClick={prevPage}
          disabled={currentPage === 0}
          aria-label="Previous page"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Page frame */}
        <div className={styles.pageFrame}>
          <div className={`${styles.pageInner} ${pageSlideClass}`}>
            <PageRenderer page={page} imageVersion={imageVersion} />
          </div>
        </div>

        {/* Next arrow */}
        <button
          className={`${styles.navArrow} ${styles.navArrowRight} ${currentPage === pages.length - 1 ? styles.navArrowDisabled : ''}`}
          onClick={nextPage}
          disabled={currentPage === pages.length - 1}
          aria-label="Next page"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </main>

      {/* ── FOOTER SCRUBBER ── */}
      <footer className={styles.footer}>
        <button
          className={styles.footerNavBtn}
          onClick={prevPage}
          disabled={currentPage === 0}
        >
          ← Prev
        </button>

        <div className={styles.scrubber}>
          {pages.map((_, i) => {
            const isActive = i === currentPage;
            const isNear = Math.abs(i - currentPage) <= 3;
            return (
              <button
                key={i}
                onClick={() => goToPage(i)}
                className={styles.scrubDot}
                title={`Page ${i + 1}`}
                aria-label={`Go to page ${i + 1}`}
                style={{
                  width: isActive ? 24 : isNear ? 6 : 4,
                  height: isActive ? 4 : isNear ? 4 : 3,
                  background: isActive
                    ? 'var(--dr-accent)'
                    : isNear
                    ? 'rgba(255,255,255,0.25)'
                    : 'rgba(255,255,255,0.1)',
                  borderRadius: 99,
                  transition: 'all 0.25s ease',
                  flexShrink: 0,
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            );
          })}
        </div>

        <button
          className={styles.footerNavBtn}
          onClick={nextPage}
          disabled={currentPage === pages.length - 1}
        >
          Next →
        </button>
      </footer>

      {/* ── TABLE OF CONTENTS DRAWER ── */}
      {isTocOpen && (
        <div className={styles.tocOverlay} onClick={() => setIsTocOpen(false)}>
          <aside className={styles.tocDrawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.tocHeader}>
              <h3 className={styles.tocTitle}>Contents</h3>
              <button
                className={styles.tocClose}
                onClick={() => setIsTocOpen(false)}
                aria-label="Close contents"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className={styles.tocNav}>
              {pages.map((p, i) => {
                const isActive = i === currentPage;
                const label =
                  (p.content as any)?.title ||
                  (p.content as any)?.name ||
                  p.type.replace(/-/g, ' ');
                return (
                  <button
                    key={p.id}
                    onClick={() => goToPage(i)}
                    className={`${styles.tocItem} ${isActive ? styles.tocItemActive : ''}`}
                  >
                    <span className={styles.tocNum}>{String(i + 1).padStart(2, '0')}</span>
                    <span className={styles.tocLabel}>{label}</span>
                    <span className={styles.tocType}>{p.type.replace(/-/g, ' ')}</span>
                  </button>
                );
              })}
            </nav>

            <div className={styles.tocFooter}>
              <p className={styles.tocIssueName}>{issue?.title || 'Current Issue'}</p>
              <Link href="/membership" className={styles.tocCta}>
                Join the Community
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE RENDERER
// ─────────────────────────────────────────────
function PageRenderer({ page, imageVersion }: { page: MagazinePage; imageVersion: string }) {
  if (!page) return null;
  const data = page.content as any;

  switch (page.type) {
    case 'cover':
      return <CoverPage data={data} imageVersion={imageVersion} />;
    case 'editorial':
      return <EditorialPage data={data} imageVersion={imageVersion} />;
    case 'contents':
      return <ContentsPage data={data} />;
    case 'feature-left': case'feature-right':
      return <FeaturePage data={data} imageVersion={imageVersion} flip={page.type === 'feature-right'} />;
    case 'spotlight':
      return <SpotlightPage data={data} imageVersion={imageVersion} />;
    case 'column':
      return <ColumnPage data={data} imageVersion={imageVersion} />;
    case 'lifestyle':
      return <LifestylePage data={data} imageVersion={imageVersion} />;
    case 'partner':
      return <PartnerPage data={data} imageVersion={imageVersion} />;
    case 'back-cover':
      return <BackCoverPage data={data} imageVersion={imageVersion} />;
    default:
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: 14 }}>
          Page type &ldquo;{page.type}&rdquo; coming soon
        </div>
      );
  }
}

// ─────────────────────────────────────────────
// COVER PAGE
// ─────────────────────────────────────────────
function CoverPage({ data, imageVersion }: { data: any; imageVersion: string }) {
  const imgUrl = data.image ? fixMagazineImageUrl(data.image, imageVersion) : null;
  return (
    <div style={{ position: 'relative', minHeight: '100%', background: '#0a0806', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
      {/* Background image */}
      {imgUrl && (
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url('${imgUrl}')`,
            backgroundSize: 'cover', backgroundPosition: 'center top',
          }}
        />
      )}
      {/* Gradient overlays */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.1) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)' }} />

      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom, transparent, #8b1f3f 25%, #8b1f3f 75%, transparent)' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, padding: '3rem 3rem 3rem 3.5rem', maxWidth: 560 }}>
        {/* Badge */}
        <div style={{ marginBottom: '1.5rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 99,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b1f3f', display: 'inline-block' }} />
            {[data.date, data.issue].filter(Boolean).join(' · ') || 'Digital Edition'}
          </span>
        </div>

        {/* Masthead */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 'clamp(2.8rem, 7vw, 5rem)',
            fontWeight: 600, lineHeight: 1.0,
            color: '#fff', margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Yorkshire<br />
            <span style={{ color: '#8b1f3f' }}>Business</span><br />
            Woman
          </h1>
        </div>

        {/* Feature callout */}
        {(data.headline || data.subheadline) && (
          <div style={{
            display: 'inline-flex', alignItems: 'flex-start', gap: 12,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, padding: '14px 18px',
            maxWidth: 420, marginBottom: '1.75rem',
          }}>
            <div style={{ width: 2, minHeight: 40, background: '#8b1f3f', borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
            <div>
              {data.badge && (
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8b1f3f', margin: '0 0 4px' }}>
                  {data.badge}
                </p>
              )}
              {data.headline && (
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.4 }}>{data.headline}</p>
              )}
              {data.subheadline && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: '4px 0 0', lineHeight: 1.5 }}>{data.subheadline}</p>
              )}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/new-edition" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 24px', borderRadius: 99,
            background: '#8b1f3f', color: '#fff',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
            textDecoration: 'none', textTransform: 'uppercase',
          }}>
            Browse Archive
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </Link>
          <Link href="/membership" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 24px', borderRadius: 99,
            border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.8)',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
            textDecoration: 'none', textTransform: 'uppercase',
          }}>
            Join the Community
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// EDITORIAL PAGE
// ─────────────────────────────────────────────
function EditorialPage({ data, imageVersion }: { data: any; imageVersion: string }) {
  const imgUrl = data.image ? fixMagazineImageUrl(data.image, imageVersion) : null;
  return (
    <div style={{ background: '#faf7f2', minHeight: '100%', overflow: 'auto' }}>
      {/* Top accent */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #8b1f3f 0%, #c0394f 50%, #8b1f3f 100%)' }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Section label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '2.5rem' }}>
          <div style={{ height: 1, flex: 1, background: 'linear-gradient(to right, transparent, rgba(139,31,63,0.35))' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8b1f3f', whiteSpace: 'nowrap' }}>
            Editor&apos;s Note
          </span>
          <div style={{ height: 1, flex: 1, background: 'linear-gradient(to left, transparent, rgba(139,31,63,0.35))' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: imgUrl ? '280px 1fr' : '1fr', gap: '3rem', alignItems: 'start' }}>
          {imgUrl && (
            <div>
              <div style={{ borderRadius: 16, overflow: 'hidden', aspectRatio: '3/4', boxShadow: '0 12px 48px rgba(139,31,63,0.15)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl} alt={data.author || 'Editor'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              {data.author && (
                <div style={{ marginTop: 16, padding: '14px 18px', background: '#fff', borderRadius: 10, border: '1px solid #e8d5c0' }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8b1f3f', margin: '0 0 4px' }}>Editor</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1c1410', margin: '0 0 2px' }}>{data.author}</p>
                  <p style={{ fontSize: 12, color: '#7a6e65', margin: 0 }}>Yorkshire BusinessWoman Magazine</p>
                </div>
              )}
            </div>
          )}

          <div>
            {data.title && (
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 600, color: '#1c1410', margin: '0 0 1.25rem', lineHeight: 1.2 }}>
                {data.title}
              </h2>
            )}

            {data.quote && (
              <blockquote style={{ borderLeft: '3px solid #8b1f3f', paddingLeft: 20, margin: '0 0 1.5rem', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 'clamp(1.1rem, 2.2vw, 1.4rem)', color: '#8b1f3f', lineHeight: 1.5 }}>
                &ldquo;{data.quote}&rdquo;
              </blockquote>
            )}

            {(data.intro || data.text) && (
              <div
                style={{ fontSize: 15, lineHeight: 1.8, color: 'rgba(61,43,31,0.85)', marginBottom: '1.5rem' }}
                dangerouslySetInnerHTML={{ __html: data.intro || data.text || '' }}
              />
            )}

            {data.author && (
              <div style={{ paddingTop: 16, borderTop: '1px solid rgba(139,31,63,0.15)' }}>
                <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#3d2b1f', fontSize: 14, margin: '0 0 6px' }}>With warmth and ambition,</p>
                <p style={{ fontWeight: 700, color: '#8b1f3f', fontSize: 15, margin: 0 }}>{data.author.split(' ')[0]}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CONTENTS PAGE
// ─────────────────────────────────────────────
function ContentsPage({ data }: { data: any }) {
  const items = Array.isArray(data.items) ? data.items : [];
  return (
    <div style={{ background: '#111009', minHeight: '100%', overflow: 'auto', color: '#e8e0d8' }}>
      <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #8b1f3f 30%, #8b1f3f 70%, transparent)' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          {data.kicker && (
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8b1f3f', margin: '0 0 8px' }}>{data.kicker}</p>
          )}
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.1 }}>
            {data.title || 'In This Issue'}
          </h2>
        </div>

        {/* Items grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {items.map((item: any, i: number) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '18px 20px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderLeft: '40px solid transparent', borderTop: '40px solid rgba(139,31,63,0.08)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8b1f3f' }}>{item.category}</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: 'rgba(255,255,255,0.06)', fontFamily: 'Georgia, serif', lineHeight: 1 }}>
                  {String(item.page || i + 1).padStart(3, '0')}
                </span>
              </div>
              <p style={{ fontFamily: 'Georgia, serif', fontWeight: 600, fontSize: 14, color: 'rgba(255,255,255,0.88)', margin: 0, lineHeight: 1.4 }}>{item.title}</p>
              <div style={{ marginTop: 12, height: 2, width: 28, borderRadius: 99, background: '#8b1f3f' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FEATURE PAGE (left / right)
// ─────────────────────────────────────────────
function FeaturePage({ data, imageVersion, flip }: { data: any; imageVersion: string; flip: boolean }) {
  const imgUrl = data.image ? fixMagazineImageUrl(data.image, imageVersion) : null;
  const kicker = data.kicker || data.category || '';
  const stats = Array.isArray(data.stats) ? data.stats : [];

  const textCol = (
    <div style={{ padding: '3rem 2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
      {kicker && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ height: 1, width: 32, background: '#8b1f3f' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8b1f3f' }}>{kicker}</span>
        </div>
      )}
      {data.name && <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', margin: 0 }}>{data.name}</p>}
      {data.title && (
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.6rem, 3vw, 2.6rem)', fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.15 }}>
          {data.title}
        </h2>
      )}
      {data.quote && (
        <blockquote style={{ borderLeft: '3px solid #8b1f3f', paddingLeft: 18, margin: 0, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>
          &ldquo;{data.quote}&rdquo;
        </blockquote>
      )}
      {(data.text || data.body) && (
        <div
          style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(232,224,216,0.75)' }}
          dangerouslySetInnerHTML={{ __html: data.text || data.body || '' }}
        />
      )}
      {stats.length > 0 && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {stats.map((s: any, i: number) => (
            <div key={i}>
              <p style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, color: '#8b1f3f', margin: 0, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const imageCol = (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 400 }}>
      {imgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt={data.title || data.name || kicker || 'Feature'} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', position: 'absolute', inset: 0 }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a0d12 0%, #2d1520 100%)' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: flip ? 'linear-gradient(to right, rgba(13,11,10,0.4) 0%, transparent 60%)' : 'linear-gradient(to left, rgba(13,11,10,0.4) 0%, transparent 60%)' }} />
    </div>
  );

  return (
    <div style={{ background: '#0d0b0a', minHeight: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'auto' }}>
      {flip ? <>{imageCol}{textCol}</> : <>{textCol}{imageCol}</>}
    </div>
  );
}

// ─────────────────────────────────────────────
// SPOTLIGHT PAGE
// ─────────────────────────────────────────────
function SpotlightPage({ data, imageVersion }: { data: any; imageVersion: string }) {
  const imgUrl = data.image ? fixMagazineImageUrl(data.image, imageVersion) : null;
  return (
    <div style={{ position: 'relative', minHeight: '100%', background: '#0a0806', overflow: 'auto' }}>
      {imgUrl && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('${imgUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center top' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.2) 100%)' }} />
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'flex-end', minHeight: '100%', padding: '3rem 3rem 3.5rem' }}>
        <div style={{ maxWidth: 640 }}>
          {(data.kicker || data.category) && (
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8b1f3f', margin: '0 0 12px' }}>
              {data.kicker || data.category}
            </p>
          )}
          {data.name && (
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 600, color: '#fff', margin: '0 0 12px', lineHeight: 1.1 }}>
              {data.name}
            </h2>
          )}
          {data.title && (
            <p style={{ fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)', color: 'rgba(255,255,255,0.7)', margin: '0 0 20px', lineHeight: 1.6 }}>{data.title}</p>
          )}
          {data.quote && (
            <blockquote style={{ borderLeft: '3px solid #8b1f3f', paddingLeft: 18, margin: '0 0 20px', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 'clamp(1rem, 2vw, 1.3rem)', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
              &ldquo;{data.quote}&rdquo;
            </blockquote>
          )}
          {(data.text || data.body) && (
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(255,255,255,0.65)' }} dangerouslySetInnerHTML={{ __html: data.text || data.body || '' }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COLUMN PAGE
// ─────────────────────────────────────────────
function ColumnPage({ data, imageVersion }: { data: any; imageVersion: string }) {
  const imgUrl = data.image ? fixMagazineImageUrl(data.image, imageVersion) : null;
  return (
    <div style={{ background: '#faf7f2', minHeight: '100%', overflow: 'auto' }}>
      <div style={{ height: 3, background: '#8b1f3f' }} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 2rem' }}>
        {imgUrl && (
          <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: '2rem', maxHeight: 320 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt={data.author || data.title || 'Column'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        {(data.kicker || data.category) && (
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8b1f3f', margin: '0 0 10px' }}>
            {data.kicker || data.category}
          </p>
        )}
        {data.title && (
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 600, color: '#1c1410', margin: '0 0 1.25rem', lineHeight: 1.2 }}>
            {data.title}
          </h2>
        )}
        {data.quote && (
          <blockquote style={{ borderLeft: '3px solid #8b1f3f', paddingLeft: 18, margin: '0 0 1.5rem', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: '#8b1f3f', lineHeight: 1.5 }}>
            &ldquo;{data.quote}&rdquo;
          </blockquote>
        )}
        {(data.text || data.body) && (
          <div style={{ fontSize: 15, lineHeight: 1.85, color: 'rgba(61,43,31,0.85)', columnCount: 2, columnGap: '2.5rem' }} dangerouslySetInnerHTML={{ __html: data.text || data.body || '' }} />
        )}
        {data.author && (
          <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(139,31,63,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 2, background: '#8b1f3f', borderRadius: 99 }} />
            <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#3d2b1f', fontSize: 14, margin: 0 }}>{data.author}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LIFESTYLE PAGE
// ─────────────────────────────────────────────
function LifestylePage({ data, imageVersion }: { data: any; imageVersion: string }) {
  const imgUrl = data.image ? fixMagazineImageUrl(data.image, imageVersion) : null;
  const images = Array.isArray(data.images) ? data.images : [];
  return (
    <div style={{ background: '#fff', minHeight: '100%', overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: imgUrl ? '1fr 1fr' : '1fr', minHeight: '100%' }}>
        {imgUrl && (
          <div style={{ position: 'relative', overflow: 'hidden', minHeight: 400 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt={data.title || 'Lifestyle'} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
          </div>
        )}
        <div style={{ padding: '3rem 2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
          {(data.kicker || data.category) && (
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8b1f3f', margin: 0 }}>
              {data.kicker || data.category}
            </p>
          )}
          {data.title && (
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 600, color: '#1c1410', margin: 0, lineHeight: 1.2 }}>
              {data.title}
            </h2>
          )}
          {(data.text || data.body) && (
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(28,20,16,0.75)' }} dangerouslySetInnerHTML={{ __html: data.text || data.body || '' }} />
          )}
          {images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
              {images.slice(0, 3).map((img: string, i: number) => (
                <div key={i} style={{ borderRadius: 8, overflow: 'hidden', aspectRatio: '1' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fixMagazineImageUrl(img, imageVersion)} alt={`Lifestyle ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PARTNER PAGE
// ─────────────────────────────────────────────
function PartnerPage({ data, imageVersion }: { data: any; imageVersion: string }) {
  const imgUrl = data.image ? fixMagazineImageUrl(data.image, imageVersion) : null;
  return (
    <div style={{ background: '#0d0b0a', minHeight: '100%', overflow: 'auto', color: '#e8e0d8' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '2.5rem' }}>
          <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8b1f3f', whiteSpace: 'nowrap' }}>Partner Feature</span>
          <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>
        {imgUrl && (
          <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: '2rem', maxHeight: 360 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt={data.title || data.name || 'Partner'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        {data.title && (
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 600, color: '#fff', margin: '0 0 1.25rem', lineHeight: 1.2 }}>
            {data.title}
          </h2>
        )}
        {(data.text || data.body) && (
          <div style={{ fontSize: 15, lineHeight: 1.8, color: 'rgba(232,224,216,0.75)' }} dangerouslySetInnerHTML={{ __html: data.text || data.body || '' }} />
        )}
        {data.website && (
          <a href={data.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: '1.5rem', padding: '10px 22px', borderRadius: 99, border: '1px solid rgba(139,31,63,0.5)', color: '#8b1f3f', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textDecoration: 'none', textTransform: 'uppercase' }}>
            Visit Website
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BACK COVER PAGE
// ─────────────────────────────────────────────
function BackCoverPage({ data, imageVersion }: { data: any; imageVersion: string }) {
  const imgUrl = data.image ? fixMagazineImageUrl(data.image, imageVersion) : null;
  return (
    <div style={{ position: 'relative', minHeight: '100%', background: '#0a0806', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {imgUrl && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('${imgUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)' }} />
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '3rem 2rem', maxWidth: 560 }}>
        <div style={{ width: 48, height: 3, background: '#8b1f3f', borderRadius: 99, margin: '0 auto 2rem' }} />
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 600, color: '#fff', margin: '0 0 1rem', lineHeight: 1.1 }}>
          Yorkshire<br /><span style={{ color: '#8b1f3f' }}>BusinessWoman</span>
        </h2>
        {data.tagline && (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '0 0 2rem', lineHeight: 1.6 }}>{data.tagline}</p>
        )}
        <Link href="/membership" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 99, background: '#8b1f3f', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textDecoration: 'none', textTransform: 'uppercase' }}>
          Become a Member
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
        </Link>
        <div style={{ width: 48, height: 3, background: '#8b1f3f', borderRadius: 99, margin: '2rem auto 0' }} />
      </div>
    </div>
  );
}
