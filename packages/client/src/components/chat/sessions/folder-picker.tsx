import { type IconName, IconSvg } from '@/components/icon-picker/icon-picker'
import { Combobox } from '@/components/ui/combobox'
import { RippleButton } from '@/components/ui/ripple-button'
import { usePageShrink } from '@/hooks/chat/page-shrink'
import { PAGE_STEP, usePaginationWindow } from '@/hooks/chat/pagination-window'
import { api } from '@cv/convex/_generated/api'
import type { Id } from '@cv/convex/_generated/dataModel'
import { usePaginatedQuery, useQuery } from 'convex-helpers/react/cache/hooks'
import { FolderIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { PaginationButtons } from './pagination-buttons'

export function FolderIconView({ icon }: { icon?: string }) {
  return icon ? (
    <IconSvg name={icon as IconName} className="size-4 shrink-0" />
  ) : (
    <FolderIcon className="size-4 shrink-0" />
  )
}

type FolderPickerProps = {
  value?: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  organizationOnly?: boolean
  rootLabel?: string
  label?: string
  excludeBranchId?: string
  showPath?: boolean
}

export function FolderPicker({
  value,
  onChange,
  disabled,
  organizationOnly = false,
  rootLabel = 'No folder',
  label = 'Session folder',
  excludeBranchId,
  showPath = true,
}: FolderPickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listContent = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = useQuery(
    api.sessionFolders.get,
    value ? { folderId: value as Id<'sessionFolders'> } : 'skip',
  )

  const pickerArgs = {
    organizationOnly,
    excludeBranchId: excludeBranchId as Id<'sessionFolders'> | undefined,
  }

  // Keep the first page subscribed independently of the popup's pagination
  const initialPage = usePaginatedQuery(
    api.sessionFolders.picker,
    { ...pickerArgs, search: '' },
    { initialNumItems: PAGE_STEP, customPagination: true },
  )

  const popupPage = usePaginatedQuery(
    api.sessionFolders.picker,
    open ? { ...pickerArgs, search } : 'skip',
    { initialNumItems: PAGE_STEP, customPagination: true },
  )

  const {
    results: available,
    status,
    loadMore,
  } = open ? popupPage : initialPage

  const display = usePaginationWindow({
    initialSize: PAGE_STEP,
    loaded: available.length,
    status,
    loadMore,
  })

  const { showLess, shrinking } = usePageShrink({
    ref: listContent,
    groupKey: 'picker',
    entryCount: display.visible,
    shrinkCount: display.shrinkCount,
    onShowLess: display.showLess,
    disabled: !open,
  })

  useEffect(() => {
    if (search && available.length < PAGE_STEP && status === 'CanLoadMore')
      loadMore(PAGE_STEP)
  }, [search, available.length, status, loadMore])

  const loadingSelection = Boolean(value) && selected === undefined
  const loading = loadingSelection || status === 'LoadingFirstPage'
  const controlsDisabled = disabled || loading

  return (
    <Combobox
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setSearch('')
          display.reset()
        }
      }}
      value={value ?? 'ungrouped'}
      onValueChange={(next) =>
        onChange(!next || next === 'ungrouped' ? null : next)
      }
    >
      <div className="flex max-w-xs min-w-0 items-center gap-1.5">
        <Combobox.Trigger
          ref={triggerRef}
          aria-label={label}
          title={selected?.folderPath ?? rootLabel}
          variant="input"
          className="min-w-0 flex-1"
          disabled={controlsDisabled}
          aria-busy={loading || undefined}
        >
          <FolderIconView icon={selected?.icon} />
          <Combobox.DisplayValue
            label={
              value
                ? ((showPath ? selected?.folderPath : selected?.name) ??
                  (loadingSelection ? label : 'Folder unavailable'))
                : rootLabel
            }
          />
        </Combobox.Trigger>
        {value && (
          <RippleButton
            variant="stealth"
            size="icon"
            className="text-muted-foreground size-8 shrink-0"
            aria-label={`Clear ${label.toLowerCase()}`}
            title="Clear folder"
            disabled={controlsDisabled}
            onClick={() => {
              onChange(null)
              triggerRef.current?.focus()
            }}
          >
            <XIcon />
          </RippleButton>
        )}
      </div>
      <Combobox.Content
        shouldFilter={false}
        side="top"
        className="w-[calc(min(fit-content,100%,200px))]"
      >
        <Combobox.Search
          placeholder="Search folders…"
          aria-label="Search folders"
          onValueChange={(value) => {
            setSearch(value)
            display.reset()
          }}
        />
        <Combobox.List className="max-h-52">
          <div ref={listContent} className="data-page-shrinking:overflow-clip">
            {status === 'Exhausted' && (
              <Combobox.Empty>No folders found.</Combobox.Empty>
            )}
            <Combobox.Group>
              {rootLabel
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase()) && (
                <Combobox.Item value="ungrouped" searchText={rootLabel}>
                  {rootLabel}
                </Combobox.Item>
              )}
              {available.slice(0, display.visible).map((folder) => (
                <Combobox.Item
                  key={folder._id}
                  value={folder._id}
                  searchText={folder.folderPath}
                  data-page-entry="picker"
                >
                  <span className="flex items-center gap-2">
                    <FolderIconView icon={folder.icon} />
                    <span className="truncate" title={folder.folderPath}>
                      {folder.folderPath}
                    </span>
                  </span>
                </Combobox.Item>
              ))}
            </Combobox.Group>
            {display.status !== 'LoadingFirstPage' && (
              <PaginationButtons
                onShowMore={
                  display.status !== 'Exhausted'
                    ? () => display.showMore(PAGE_STEP)
                    : undefined
                }
                onShowLess={showLess}
                disabled={display.status === 'LoadingMore' || shrinking}
              />
            )}
          </div>
        </Combobox.List>
      </Combobox.Content>
    </Combobox>
  )
}
