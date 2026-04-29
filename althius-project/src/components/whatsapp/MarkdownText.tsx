import React from 'react'

interface Props {
  md: string | null
  className?: string
}

type Node =
  | { kind: 'text';   value: string }
  | { kind: 'bold';   children: Node[] }
  | { kind: 'italic'; children: Node[] }
  | { kind: 'strike'; children: Node[] }
  | { kind: 'code';   value: string }
  | { kind: 'link';   href: string; value: string }
  | { kind: 'br' }

function parseInline(src: string): Node[] {
  const out: Node[] = []
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    pushInlineLine(out, line)
    if (i < lines.length - 1) out.push({ kind: 'br' })
  })
  return out
}

function pushInlineLine(out: Node[], line: string) {
  const re = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|~~[^~\n]+~~|`[^`\n]+`|https?:\/\/\S+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ kind: 'text', value: line.slice(last, m.index) })
    const t = m[0]
    if (t.startsWith('**'))     out.push({ kind: 'bold',   children: [{ kind: 'text', value: t.slice(2, -2) }] })
    else if (t.startsWith('~~')) out.push({ kind: 'strike', children: [{ kind: 'text', value: t.slice(2, -2) }] })
    else if (t.startsWith('`'))  out.push({ kind: 'code',   value: t.slice(1, -1) })
    else if (t.startsWith('*'))  out.push({ kind: 'italic', children: [{ kind: 'text', value: t.slice(1, -1) }] })
    else                         out.push({ kind: 'link',   href: t, value: t })
    last = m.index + t.length
  }
  if (last < line.length) out.push({ kind: 'text', value: line.slice(last) })
}

function renderNode(n: Node, key: number): React.ReactNode {
  switch (n.kind) {
    case 'text':   return <React.Fragment key={key}>{n.value}</React.Fragment>
    case 'br':     return <br key={key} />
    case 'bold':   return <strong key={key}>{n.children.map((c, i) => renderNode(c, i))}</strong>
    case 'italic': return <em key={key}>{n.children.map((c, i) => renderNode(c, i))}</em>
    case 'strike': return <del key={key}>{n.children.map((c, i) => renderNode(c, i))}</del>
    case 'code':   return <code key={key} className="px-1 py-0.5 rounded text-xs" style={{ background: '#00000040' }}>{n.value}</code>
    case 'link':   return <a key={key} href={n.href} target="_blank" rel="noreferrer" style={{ color: '#60A5FA', textDecoration: 'underline' }}>{n.value}</a>
  }
}

export function MarkdownText({ md, className }: Props) {
  if (!md) return null
  const nodes = parseInline(md)
  return <span className={className}>{nodes.map((n, i) => renderNode(n, i))}</span>
}
