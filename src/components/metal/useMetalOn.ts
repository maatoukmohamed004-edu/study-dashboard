import type { MetalTarget } from '../../data/settings-schema'
import { useResolved } from '../../lib/theme'

/** Whether Liquid metal is drawn on this kind of control (for the host's data-metal attribute). */
export function useMetalOn(target: MetalTarget): boolean {
  return useResolved().metal.on[target]
}
