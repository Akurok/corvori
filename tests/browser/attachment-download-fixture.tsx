import { FileBlock } from '@/components/chat/messages/file-block'
import { AttachmentAnchor } from '@/components/markdown/attachment-anchor'
import { FileStrip } from '@/components/ui/file-strip'
import { LightboxProvider } from '@/components/ui/lightbox'
import { AttachmentUrlProvider } from '@/hooks/chat/attachment-urls'
import type { FileItem } from '@/hooks/file-previews'
import { ConvexProvider, type ConvexReactClient } from 'convex/react'

const files: FileItem[] = [
  {
    id: 'image',
    file: new File([], 'image.png', { type: 'image/png' }),
    url: 'attachment:image',
    originalUrl: 'https://storage.example.test/image-original',
    permaUrl: 'https://site.example.test/attachments/image/image.png',
  },
]

const publishedUrl = 'attachment:published'
const images = {
  first: { width: 320, height: 400 },
  second: { width: 1200, height: 1800 },
}
const attachmentUrls = {
  published: {
    url: 'https://storage.example.test/published-pdf',
    byteLength: 13,
    mediaType: 'application/pdf',
    filename: 'processed.pdf',
  },
  ...Object.fromEntries(
    Object.entries(images).map(([id, imageDimensions]) => [
      id,
      {
        url: `https://storage.example.test/${id}-original.png`,
        previewUrl: `https://storage.example.test/${id}-preview.png`,
        imageDimensions,
      },
    ]),
  ),
}
const attachmentClient = {
  watchQuery() {
    return {
      onUpdate: () => () => {},
      localQueryResult: () => attachmentUrls,
      localQueryLogs: () => [],
      journal: () => undefined,
    }
  },
} as unknown as ConvexReactClient

/** Mirrors the pointer-event guard on the virtualized chat list. */
function AttachmentGalleryFixture() {
  const ids = Object.keys(images)
  return (
    <LightboxProvider>
      <ConvexProvider client={attachmentClient}>
        <AttachmentUrlProvider />
        <div style={{ pointerEvents: 'none' }}>
          <FileBlock
            parts={ids.map((id) => ({
              type: 'file',
              url: `attachment:${id}`,
              mediaType: 'image/png',
              filename: `${id}.png`,
            }))}
            attachmentIds={Object.fromEntries(
              ids.map((id) => [`attachment:${id}`, id]),
            )}
          />
        </div>
      </ConvexProvider>
    </LightboxProvider>
  )
}

export function AttachmentDownloadFixture() {
  if (new URLSearchParams(location.search).has('gallery')) {
    return <AttachmentGalleryFixture />
  }

  return (
    <>
      <FileStrip files={files} noAnimation />
      <ConvexProvider client={attachmentClient}>
        <AttachmentUrlProvider />
        <FileBlock
          parts={[
            {
              type: 'file',
              url: publishedUrl,
              mediaType: 'application/pdf',
              filename: 'processed.pdf',
            },
          ]}
          attachmentIds={{ [publishedUrl]: 'published' }}
        />
      </ConvexProvider>
      <AttachmentAnchor href="attachment:notes/caf%C3%A9.json">
        Shared notes
      </AttachmentAnchor>
    </>
  )
}
