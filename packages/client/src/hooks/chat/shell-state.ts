import type { ChatProps } from '@/components/chat/chat-types'
import type { AgentItem } from '@/components/chat/sessions/agent-combobox'
import { getFontFamily } from '@/fonts'
import {
  useActiveAgentQuery,
  useActiveSessionStatus,
  useSettings,
  useValidatedSessionId,
} from '@/hooks/chat'
import { resolveFonts, useSettingsOverride } from '@/hooks/font'
import { useStableValue } from '@/hooks/stable-value'
import { useTheme } from '@/hooks/theme'
import {
  type CSSProperties,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'

type ChatShellState = {
  activeSessionId: string | null
  activeAgentName?: string
  activeAgentDisplay?: AgentItem
  markSessionSettled: () => void
  style: CSSProperties
}

export function useChatShellState(
  layoutConstraint: ChatProps['layoutConstraint'],
): ChatShellState {
  const activeSessionId = useValidatedSessionId()
  const activeAgent = useActiveAgentQuery()
  const sessionStatus = useActiveSessionStatus()
  const settings = useSettings()
  const override = useSettingsOverride()

  const [sessionLoad, setSessionLoad] = useState({
    sessionId: activeSessionId,
    settled: false,
  })
  const sessionChanged = sessionLoad.sessionId !== activeSessionId
  if (sessionChanged) {
    setSessionLoad({ sessionId: activeSessionId, settled: false })
  }

  const markSessionSettled = useCallback(() => {
    setSessionLoad((current) =>
      current.sessionId === activeSessionId && !current.settled
        ? { ...current, settled: true }
        : current,
    )
  }, [activeSessionId])

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const globalThemeColor = settings?.theme?.source ?? null
  const globalThemeMode = settings?.themeMode ?? null
  const agentThemeColor = activeAgent?.theme?.source ?? null
  const preserveAgent = sessionStatus === 'loading' || activeAgent === undefined
  const activeAgentName = useStableValue(activeAgent?.name, preserveAgent)
  const activeAgentId = activeAgent?._id
  const activeAgentAvatarId = activeAgent?.avatarId

  // Display fallback to avoid flickers during session load
  const nextActiveAgentDisplay = useMemo<AgentItem | undefined>(
    () =>
      activeAgentId && activeAgentName
        ? {
            id: activeAgentId,
            name: activeAgentName,
            avatarId: activeAgentAvatarId,
          }
        : undefined,
    [activeAgentId, activeAgentName, activeAgentAvatarId],
  )

  const activeAgentDisplay = useStableValue(
    nextActiveAgentDisplay,
    preserveAgent,
  )

  const waitingForTranscript =
    activeSessionId !== null && (sessionChanged || !sessionLoad.settled)
  useTheme(agentThemeColor || globalThemeColor, 'you', globalThemeMode, {
    deferColor: preserveAgent || waitingForTranscript,
  })

  const fonts = resolveFonts(settings, override)
  const chatFont = mounted && settings ? fonts.chatFont : null
  const chatFontSize = mounted && settings ? fonts.chatFontSize : null

  const style = useMemo(
    () =>
      ({
        width: `100${layoutConstraint || '%'}`,
        ...(chatFont !== null && {
          '--chat-font-family': getFontFamily(chatFont),
          '--chat-font-size': `${chatFontSize}px`,
        }),
      }) as CSSProperties,
    [layoutConstraint, chatFont, chatFontSize],
  )

  return {
    activeSessionId,
    activeAgentName,
    activeAgentDisplay,
    markSessionSettled,
    style,
  }
}
