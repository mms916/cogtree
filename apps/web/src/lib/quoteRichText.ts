const ALLOWED_TAGS = new Set(['P', 'B', 'STRONG', 'U', 'FONT', 'SPAN', 'DIV', 'BR'])

export function sanitizeQuoteHtml(html: string) {
  if (typeof document === 'undefined') return html.replace(/[<>]/g, '')
  const root = document.createElement('div')
  root.innerHTML = html

  const clean = (element: Element) => {
    Array.from(element.children).forEach(clean)
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      return
    }
    Array.from(element.attributes).forEach((attribute) => {
      if (element.tagName === 'FONT' && attribute.name === 'size') return
      if (element.tagName === 'FONT' && attribute.name === 'color') return
      if (element.tagName === 'SPAN' && attribute.name === 'style') {
        const safeStyles = attribute.value
          .split(';')
          .map((declaration) => declaration.trim())
          .filter((declaration) => /^(color:\s*(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\))|font-size:\s*(1[0-9]|2[0-8])px)$/i.test(declaration))
        if (safeStyles.length > 0) {
          element.setAttribute('style', safeStyles.join('; '))
          return
        }
      }
      element.removeAttribute(attribute.name)
    })
  }

  Array.from(root.children).forEach(clean)
  return root.innerHTML
}
