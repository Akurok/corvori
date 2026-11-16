import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

const markdown = unified().use(remarkParse).use(remarkGfm).freeze()

type MarkdownNode = {
  type: string
  value?: string
  alt?: string | null
  children?: MarkdownNode[]
}

type MarkdownPreview = { prose: string; code: string }

/** Extracts visible text and retains the first code block as a fallback. */
export function readMarkdownPreview(text: string): MarkdownPreview {
  const preview = { prose: '', code: '' }
  preview.prose = readNode(markdown.parse(text), preview).trim()
  return preview
}

function readNode(node: MarkdownNode, preview: MarkdownPreview): string {
  switch (node.type) {
    case 'code':
      preview.code ||= node.value?.trim() ?? ''
      return ''
    case 'text':
    case 'inlineCode':
      return node.value ?? ''
    case 'image':
    case 'imageReference':
      return node.alt ?? ''
    case 'break':
      return '\n'
    default:
      return (
        node.children
          ?.map((child) => readNode(child, preview))
          .join(childSeparator(node.type)) ?? ''
      )
  }
}

function childSeparator(type: string) {
  switch (type) {
    case 'root':
    case 'blockquote':
    case 'list':
    case 'listItem':
    case 'table':
      return '\n'
    case 'tableRow':
      return ' '
    default:
      return ''
  }
}

/** Collapses whitespace and limits a preview without splitting a surrogate pair. */
export function limitPreview(text: string, length: number): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, length)
    .replace(/[\uD800-\uDBFF]$/, '')
    .trimEnd()
}
