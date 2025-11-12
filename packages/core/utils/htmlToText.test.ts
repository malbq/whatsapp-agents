import { describe, expect, test } from 'bun:test'
import { extractTextFromHTML } from './htmlToText'

describe('extractTextFromHTML', () => {
  test('extracts plain text from simple HTML', async () => {
    const html = '<p>Hello world</p>'
    const text = await extractTextFromHTML(html)
    expect(text).toBe('Hello world')
  })

  test('removes script tags', async () => {
    const html = '<p>Content</p><script>alert("test")</script>'
    const text = await extractTextFromHTML(html)
    expect(text).toBe('Content')
    expect(text).not.toContain('alert')
  })

  test('removes style tags', async () => {
    const html = '<p>Content</p><style>.test { color: red; }</style>'
    const text = await extractTextFromHTML(html)
    expect(text).toBe('Content')
    expect(text).not.toContain('color')
  })

  test('removes noscript tags', async () => {
    const html = '<p>Content</p><noscript>No JS</noscript>'
    const text = await extractTextFromHTML(html)
    expect(text).toBe('Content')
    expect(text).not.toContain('No JS')
  })

  test('removes iframe tags', async () => {
    const html = '<p>Content</p><iframe src="test.html">Frame</iframe>'
    const text = await extractTextFromHTML(html)
    expect(text).toBe('Content')
    expect(text).not.toContain('Frame')
  })

  test('extracts text from nested elements', async () => {
    const html = '<div><p>First</p><p>Second</p></div>'
    const text = await extractTextFromHTML(html)
    expect(text).toContain('First')
    expect(text).toContain('Second')
  })

  test('handles multiple paragraphs', async () => {
    const html = '<p>Paragraph 1</p><p>Paragraph 2</p><p>Paragraph 3</p>'
    const text = await extractTextFromHTML(html)
    expect(text).toContain('Paragraph 1')
    expect(text).toContain('Paragraph 2')
    expect(text).toContain('Paragraph 3')
  })

  test('trims whitespace', async () => {
    const html = '  <p>  Content  </p>  '
    const text = await extractTextFromHTML(html)
    expect(text).toBe('Content')
  })

  test('normalizes multiple newlines', async () => {
    const html = '<p>Line 1</p>\n\n\n<p>Line 2</p>'
    const text = await extractTextFromHTML(html)
    expect(text).not.toMatch(/\n{3,}/)
  })

  test('handles empty HTML', async () => {
    const html = ''
    const text = await extractTextFromHTML(html)
    expect(text).toBe('')
  })

  test('handles HTML with only whitespace', async () => {
    const html = '   \n   '
    const text = await extractTextFromHTML(html)
    expect(text).toBe('')
  })

  test('extracts text from complex HTML structure', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <header><h1>Header</h1></header>
          <main>
            <article>
              <h2>Article Title</h2>
              <p>Article content</p>
            </article>
          </main>
          <footer>Footer</footer>
        </body>
      </html>
    `
    const text = await extractTextFromHTML(html)
    expect(text).toContain('Header')
    expect(text).toContain('Article Title')
    expect(text).toContain('Article content')
    expect(text).toContain('Footer')
  })

  test('handles special characters', async () => {
    const html = '<p>&lt;Special&gt; &amp; Characters</p>'
    const text = await extractTextFromHTML(html)
    expect(text).toContain('Special')
    expect(text).toContain('Characters')
  })

  test('handles links', async () => {
    const html = '<p>Click <a href="test.html">here</a> for more</p>'
    const text = await extractTextFromHTML(html)
    expect(text).toContain('Click')
    expect(text).toContain('here')
    expect(text).toContain('for more')
  })

  test('handles lists', async () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>'
    const text = await extractTextFromHTML(html)
    expect(text).toContain('Item 1')
    expect(text).toContain('Item 2')
    expect(text).toContain('Item 3')
  })

  test('handles tables', async () => {
    const html = `
      <table>
        <tr><td>Cell 1</td><td>Cell 2</td></tr>
        <tr><td>Cell 3</td><td>Cell 4</td></tr>
      </table>
    `
    const text = await extractTextFromHTML(html)
    expect(text).toContain('Cell 1')
    expect(text).toContain('Cell 2')
    expect(text).toContain('Cell 3')
    expect(text).toContain('Cell 4')
  })

  test('removes embed tags', async () => {
    const html = '<p>Content</p><embed src="test.swf">'
    const text = await extractTextFromHTML(html)
    expect(text).toBe('Content')
  })

  test('removes object tags', async () => {
    const html = '<p>Content</p><object data="test.pdf">Object</object>'
    const text = await extractTextFromHTML(html)
    expect(text).toBe('Content')
    expect(text).not.toContain('Object')
  })

  test('handles invalid HTML gracefully', async () => {
    const html = '<p>Unclosed paragraph'
    const text = await extractTextFromHTML(html)
    expect(text).toBe('Unclosed paragraph')
  })

  test('handles null input gracefully', async () => {
    const invalidInput = null as any
    const text = await extractTextFromHTML(invalidInput)
    // HTMLRewriter handles null gracefully and returns empty string
    expect(text).toBe('')
  })
})
