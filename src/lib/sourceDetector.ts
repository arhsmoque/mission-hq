/**
 * Detects the flipbook/document source type from a URL.
 * Used by the resource directory to auto-label entries and
 * determine the correct page-image URL pattern for extraction.
 */

export type SourceType = 'anyflip' | 'fliphtml5' | 'pdf_url' | 'website';

export interface SourceInfo {
  type: SourceType;
  label: string;
  color: string;
  accountId?: string;
  bookId?: string;
  pageImageTemplate?: string; // e.g. "https://.../{n}.jpg" with {n} placeholder
}

export function detectSource(rawUrl: string): SourceInfo {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { type: 'website', label: 'Website', color: '#a3a3a3' };
  }

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);

  // AnyFlip — anyflip.com/{account}/{bookId} or online.anyflip.com/{account}/{bookId}
  if (host.includes('anyflip.com') && parts.length >= 2) {
    const [accountId, bookId] = parts;
    return {
      type: 'anyflip',
      label: 'AnyFlip',
      color: '#f97316',
      accountId,
      bookId,
      pageImageTemplate: `https://online.anyflip.com/${accountId}/${bookId}/files/mobile/{n}.jpg`,
    };
  }

  // FlipHTML5 — online.fliphtml5.com/{account}/{bookId} or fliphtml5.com/{account}/{bookId}
  if (host.includes('fliphtml5.com') && parts.length >= 2) {
    const [accountId, bookId] = parts;
    return {
      type: 'fliphtml5',
      label: 'FlipHTML5',
      color: '#3b82f6',
      accountId,
      bookId,
      pageImageTemplate: `https://online.fliphtml5.com/${accountId}/${bookId}/files/large/page-{n}.jpg`,
    };
  }

  // Direct PDF link
  if (url.pathname.toLowerCase().endsWith('.pdf')) {
    return { type: 'pdf_url', label: 'PDF', color: '#f87171' };
  }

  return { type: 'website', label: 'Website', color: '#a3a3a3' };
}
