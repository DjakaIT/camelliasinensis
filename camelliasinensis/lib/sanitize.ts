// Jedino mjesto gdje se HTML iz backenda pripremi za prikaz (GUIDE §5). Zove se pri buildu, ne u pregledniku.
import sanitizeHtml from 'sanitize-html';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'a'],
  allowedAttributes: { a: ['href', 'title', 'rel'] },
  allowedSchemes: ['https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
  },
};

export function sanitizeDescription(html: string): string {
  return sanitizeHtml(html ?? '', OPTIONS).trim();
}

/** Čisti tekst (za meta description i JSON-LD). */
export function htmlToText(html: string): string {
  return sanitizeHtml(html ?? '', { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
