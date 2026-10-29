/** Treat stored sentences as text when showing a card shared by another user.
 * Older cards may contain markup in their saved HTML, so reconstruct a safe
 * representation from the original sentence instead of trusting that markup.
 */
export function sharedSentenceHtml (sentence: string): string {
    return sentence.replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]!);
}
