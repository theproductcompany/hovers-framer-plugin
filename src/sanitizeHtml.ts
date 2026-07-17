import DOMPurify from "dompurify"

const ALLOWED_TAGS = [
    "a",
    "abbr",
    "b",
    "blockquote",
    "br",
    "code",
    "del",
    "div",
    "em",
    "figcaption",
    "figure",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
] as const

const ALLOWED_ATTR = [
    "alt",
    "class",
    "colspan",
    "height",
    "href",
    "rel",
    "rowspan",
    "src",
    "target",
    "title",
    "width",
] as const

/**
 * Sanitize HTML from the Hovers API before writing it into Framer CMS.
 * Uses an allowlist so scripts, event handlers, and unsafe URLs are stripped.
 */
export function sanitizeHtml(html: string): string {
    if (!html) {
        return ""
    }

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [...ALLOWED_TAGS],
        ALLOWED_ATTR: [...ALLOWED_ATTR],
        ALLOW_DATA_ATTR: false,
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
        ADD_ATTR: ["target"],
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
        FORBID_ATTR: ["style"],
    })
}
