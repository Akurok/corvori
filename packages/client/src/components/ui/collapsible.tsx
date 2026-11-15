import { cn } from '@/lib/utils'
import { ChevronRightIcon } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Accordion } from './accordion'
import { RippleButton, type RippleButtonProps } from './ripple-button'

type CollapsibleContextValue = {
  isOpen: boolean
  toggle: () => void
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null)

function useCollapsible() {
  const ctx = useContext(CollapsibleContext)
  if (!ctx)
    throw new Error(
      'Collapsible components must be used within CollapsibleRoot',
    )
  return ctx
}

type CollapsibleRootProps = React.ComponentProps<'div'> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function CollapsibleRoot({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
  ...props
}: CollapsibleRootProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const toggle = useCallback(() => {
    const next = !isOpen
    if (!isControlled) {
      setUncontrolledOpen(next)
    }
    onOpenChange?.(next)
  }, [isOpen, isControlled, onOpenChange])

  const value = useMemo(() => ({ isOpen, toggle }), [isOpen, toggle])

  return (
    <CollapsibleContext.Provider value={value}>
      <div
        data-slot="collapsible-root"
        data-open={isOpen}
        className={cn('flex flex-col rounded-xl', className)}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

function CollapsibleTrigger({
  className,
  children,
  onClick,
  ...props
}: RippleButtonProps) {
  const { isOpen, toggle } = useCollapsible()

  return (
    <RippleButton
      variant="stealth"
      size="lg"
      data-slot="collapsible-trigger"
      aria-expanded={isOpen}
      className={cn(
        'focus-visible:border-ring hover:bg-m3-surface-container-high group/collapsible flex w-full items-center justify-between rounded-none border border-transparent font-bold transition-colors outline-none focus-visible:border focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      onClick={(e) => {
        toggle()
        onClick?.(e)
      }}
      {...props}
    >
      {children}
      <Accordion.Icon
        isExpanded={isOpen}
        className="text-muted-foreground group-hover/collapsible:text-foreground ml-auto transition-colors"
      />
    </RippleButton>
  )
}

type SubtleTriggerProps = React.ComponentProps<'button'> & {
  divider?: boolean
}

const dividerClassName =
  'border-t border-[color:var(--divider-color)] transition-colors motion-reduce:transition-none'

function CollapsibleHoverTrigger({
  className,
  children,
  divider = false,
  onClick,
  type = 'button',
  ...props
}: SubtleTriggerProps) {
  const { isOpen, toggle } = useCollapsible()

  return (
    <button
      {...props}
      type={type}
      data-slot="collapsible-trigger"
      aria-expanded={isOpen}
      className={cn(
        'text-muted-foreground focus-visible:outline-ring flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-sm transition-colors focus-visible:outline-1 focus-visible:-outline-offset-1 disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none',
        '[--divider-color:var(--color-border)] focus-visible:[--divider-color:color-mix(in_oklab,var(--color-border)_85%,var(--color-muted-foreground))] enabled:hover:[--divider-color:color-mix(in_oklab,var(--color-border)_85%,var(--color-muted-foreground))]',
        'focus-visible:text-[color-mix(in_oklab,var(--color-muted-foreground)_88%,var(--color-foreground))] enabled:hover:text-[color-mix(in_oklab,var(--color-muted-foreground)_88%,var(--color-foreground))]',
        divider && 'grid grid-cols-[1fr_auto_1fr]',
        className,
      )}
      onClick={(event) => {
        toggle()
        onClick?.(event)
      }}
    >
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <ChevronRightIcon
          className={cn(
            'size-3 shrink-0 transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-90',
          )}
        />
        {divider && <span className={cn('flex-1', dividerClassName)} />}
      </span>
      <span>{children}</span>
      {divider && <span className={dividerClassName} aria-hidden="true" />}
    </button>
  )
}

type CollapsibleContentProps = React.ComponentProps<'div'> & {
  outerClassName?: string
  /** Avoid mounting expensive content until opened, then unmount after closing. */
  unmountOnClose?: boolean
}

function CollapsibleContent({
  className,
  outerClassName,
  children,
  unmountOnClose = false,
  onTransitionEnd,
  ...props
}: CollapsibleContentProps) {
  const { isOpen } = useCollapsible()
  const [retained, setRetained] = useState(isOpen)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!unmountOnClose || isOpen || !retained) return
    // Empty branches and disabled transitions may not emit transitionend
    const timer = setTimeout(() => setRetained(false), reducedMotion ? 0 : 250)
    return () => clearTimeout(timer)
  }, [unmountOnClose, isOpen, retained, reducedMotion])

  if (unmountOnClose && isOpen && !retained) setRetained(true)

  const renderChildren =
    !unmountOnClose || isOpen || (retained && !reducedMotion)

  return (
    <div
      data-slot="collapsible-content"
      inert={!isOpen}
      aria-hidden={!isOpen || undefined}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none',
        isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        outerClassName,
      )}
      style={{
        gridTemplateRows: isOpen ? '1fr' : '0fr',
      }}
      onTransitionEnd={(event) => {
        onTransitionEnd?.(event)
        if (
          unmountOnClose &&
          !isOpen &&
          event.target === event.currentTarget &&
          event.propertyName === 'grid-template-rows'
        ) {
          setRetained(false)
        }
      }}
      {...props}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn('flex flex-col gap-1.5 px-4 py-2 pt-1.5', className)}
        >
          {renderChildren ? children : null}
        </div>
      </div>
    </div>
  )
}

export const Collapsible = Object.assign(CollapsibleRoot, {
  Trigger: CollapsibleTrigger,
  HoverTrigger: CollapsibleHoverTrigger,
  Content: CollapsibleContent,
})

export { useCollapsible }
export type { CollapsibleRootProps, CollapsibleContentProps }
