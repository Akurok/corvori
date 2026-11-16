import type { DiscoveredModel } from './model-discovery'
import type { ModelEntry } from './types/providers'

export const DEFAULT_MODEL_CONTEXT_WINDOW = 256_000

export function usableContextWindow(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

/** Seeds the editable context window when adding a model to settings. */
export function initialContextWindow(model?: DiscoveredModel) {
  return (
    usableContextWindow(model?.contextWindow) ?? DEFAULT_MODEL_CONTEXT_WINDOW
  )
}

/** Extracts provider-reported defaults without catalog bookkeeping. */
export function modelMetadata(
  model: DiscoveredModel,
): ModelEntry['discovered'] {
  // Match Convex's serialized shape so metadata sync keeps saved forms clean.
  return {
    ...(model.label !== undefined ? { label: model.label } : {}),
    ...(model.contextWindow !== undefined
      ? { contextWindow: model.contextWindow }
      : {}),
    ...(model.reasoning !== undefined ? { reasoning: model.reasoning } : {}),
  }
}

/** Resolves model labels and reasoning from overrides and provider metadata. */
export function effectiveModel(model: ModelEntry): ModelEntry {
  return {
    ...model,
    label: model.label ?? model.discovered?.label,
    reasoning: model.reasoning ?? model.discovered?.reasoning,
  }
}
