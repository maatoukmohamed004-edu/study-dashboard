import type { ComponentType } from 'react'
import { NAV_PAGES } from '../../data/settings-schema'
import type { PageId } from '../../lib/env'
import { AbsencesIcon, CheckIcon, PlanIcon, ResourcesIcon, SettingsIcon, TodayIcon, WeekIcon } from '../icons'

/** Label, short label (tab bar) and icon for every page. */
export const PAGE_META: Record<PageId, { label: string; short: string; Icon: ComponentType }> = {
  today: { label: 'Today', short: 'Today', Icon: TodayIcon },
  week: { label: 'Week', short: 'Week', Icon: WeekIcon },
  plan: { label: 'Plan', short: 'Plan', Icon: PlanIcon },
  resources: { label: 'Resources', short: 'Resources', Icon: ResourcesIcon },
  absences: { label: 'Absences', short: 'Absences', Icon: AbsencesIcon },
  check: { label: 'Sunday check', short: 'Sunday', Icon: CheckIcon },
  settings: { label: 'Settings', short: 'Settings', Icon: SettingsIcon },
}

const ALL = NAV_PAGES.map((p) => p.value)

/** Pages that are not tabs, in their usual order: the contents of the "More" sheet. */
export const morePages = (tabs: readonly PageId[]) => ALL.filter((p) => !tabs.includes(p))

/** Swipe order: the tabs left to right, then the other pages (Settings is not swiped to). */
export const swipeOrder = (tabs: readonly PageId[]) => [...tabs, ...morePages(tabs).filter((p) => p !== 'settings')]
