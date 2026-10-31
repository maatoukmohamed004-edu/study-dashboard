import { useMemo } from 'react'
import { mondayOf } from './dates'
import { weekStats } from './stats'
import { useStore } from './store'

export function useWeekStats(mondayIso: string) {
  const blocks = useStore((s) => s.blocks)
  const absences = useStore((s) => s.absences)
  return useMemo(() => weekStats(mondayIso, { blocks, absences }), [mondayIso, blocks, absences])
}

export function useThisWeekStats(today: string) {
  return useWeekStats(mondayOf(today))
}
