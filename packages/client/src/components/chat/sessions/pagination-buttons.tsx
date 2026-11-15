import { RippleButton } from '@/components/ui/ripple-button'

type PaginationButtonsProps = {
  onShowMore?: () => void
  onShowLess?: () => void
  disabled?: boolean
}

export function PaginationButtons({
  onShowMore,
  onShowLess,
  disabled,
}: PaginationButtonsProps) {
  const className =
    'text-muted-foreground hover:text-foreground justify-start text-xs font-normal no-underline'

  return (
    <div className="flex items-center gap-1 py-1">
      {onShowMore && (
        <RippleButton
          variant="stealth"
          size="sm"
          className={className}
          data-pagination="more"
          onClick={onShowMore}
          disabled={disabled}
        >
          Show more
        </RippleButton>
      )}
      {onShowLess && (
        <RippleButton
          variant="stealth"
          size="sm"
          className={`ms-auto ${className}`}
          onClick={onShowLess}
          disabled={disabled}
        >
          Show less
        </RippleButton>
      )}
    </div>
  )
}
