//const logger = getLogger(['app', 'utils', 'htmlToText'])

export async function extractTextFromHTML(html: string): Promise<string> {
  try {
    let text = ''
    let skip = false

    const res = new HTMLRewriter()
      .on('script, style, noscript, iframe, object, embed', {
        element() {
          skip = true
        },
        text() {},
      })
      .on('*', {
        element(el: any) {
          if (!['script', 'style', 'noscript', 'iframe', 'object', 'embed'].includes(el.tagName)) {
            skip = false
          }
        },
        text(node: any) {
          if (!skip) text += node.text
        },
      })
      .transform(new Response(html))

    await res.text()
    return text.trim().replace(/\n+/g, '\n')
  } catch (err) {
    console.error('HTML to text conversion failed', { err })
    return 'web_fetch: error converting HTML to text'
  }
}
