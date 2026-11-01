/**
 * Help text for the Settings UI, kept out of the schema so it loads with the (lazy) Settings
 * page instead of the first-load bundle. Add a line here when a new setting needs one.
 */
import type { SectionId, SettingKey } from './settings-schema'

export const settingHelp: Partial<Record<SettingKey, string>> = {
  'appearance.preset': 'A starting point for colours, background and glass. You can change anything afterwards.',
  'appearance.colorMode': 'System follows your device setting.',
  'appearance.accent': 'Used for progress, the current page and primary buttons.',
  'appearance.background': 'The page colour. Surfaces and lines are derived from it.',
  'appearance.monoUppercase': 'Small labels, tags and captions in capitals.',
  'appearance.displayFont': 'The condensed face for big numbers and headings.',
  'appearance.roundness': 'Sets the corner radius below. Pill also makes buttons, chips and fields fully round.',
  'appearance.radius': 'The master value. Cards use it as is; buttons, fields and small marks use a share of it.',
  'appearance.radiusLink': 'On: every group follows the master radius, and the floating tab bar stays a pill. Off: set each group below.',
  'appearance.radiusNav': 'The floating tab bar on phones and its "More" panel. The docked bar stays square.',
  'appearance.radiusCards': 'Cards, chart frames, notes and the week’s blocks.',
  'appearance.radiusButtons': 'Buttons, square icon buttons, chips, tags and badges.',
  'appearance.radiusInputs': 'Text fields, selects, segmented switches and checkboxes.',
  'appearance.radiusSheets': 'The quick-settings drawer, the "More" sheet, toasts and tooltips.',
  'appearance.radiusHud': 'The double hairline frame and its corner brackets.',
  'metal.enabled': 'A thin animated chrome rim around a dark fill. Without WebGL 2 it is a still metallic rim.',
  'metal.hoverSpeed': 'Under the pointer or keyboard focus. A press briefly speeds it up further.',
  'metal.static': 'One still frame of the shader. Reduced motion always does this.',
  'background.grain': 'Film grain over the background.',
  'background.quality': 'Auto lowers the resolution when the frame rate drops.',
  'background.pauseHidden': 'Off by default: 3D drains battery and can stutter on phones.',
  'glass.tint': 'How much of the page colour covers what is behind the glass. Higher is easier to read.',
  'hud.frame': 'Double hairline border around the app.',
  'hud.caption': 'The status line in the bottom-left corner.',
  'hud.orb': "Shows this week's blocks-done percentage.",
  'motion.mode': 'Auto follows your device setting for reduced motion.',
  'nav.transition': 'What happens when you change page.',
  'nav.duration': 'At animation speed 1×. Reduced motion always uses a short crossfade.',
  'nav.softness': '0% is a hard circle; higher feathers the edge of the disc.',
  'nav.bottomBar': 'Navigation at the bottom of the screen, within thumb reach. Off brings back the scrolling top bar.',
  'nav.labels': 'Words under the tab icons. Screen readers hear them either way.',
  'nav.swipe': 'Swipe left or right to move between tabs. Ignored inside areas that scroll sideways.',
  'nav.barStyle': 'Floating: a glass pill above the bottom edge, with the page scrolling behind it. Docked: the full-width bar along the bottom.',
  'nav.barGap': 'Added to the space phones keep for the home indicator.',
  'nav.highlight': 'How the floating bar marks the current page. The label is bold either way.',
  'nav.hideOnScroll': 'The bar slides away as you scroll down and comes back as soon as you scroll up.',
  'nav.tabs': 'The four pages in the tab bar, left to right. Everything else goes to "More".',
  'sim.enabled': 'Every page behaves as if it were that moment. A banner stays on screen while this is on.',
  'sim.time': 'Leave empty to use the real time of day.',
  'diag.fps': 'Frames per second, bottom-right. Use it to check smoothness on your own machine.',
}

/** Notes on individual options ("key:value"); not shown yet, kept with the rest of the text. */
export const optionHelp: Record<string, string> = {
  'appearance.preset:mono-noir': 'Near-black, monochrome, off-white accent.',
  'appearance.preset:midnight': 'The original deep blue and violet with a mint accent.',
  'appearance.preset:graphite': 'Soft charcoal with a cool blue accent.',
  'appearance.preset:high-contrast': 'Pure black and white, yellow accent, solid surfaces.',
  'appearance.preset:light': 'Warm paper, black ink.',
  'metal.applyTo:tab': 'The current-tab pill in the floating tab bar.',
  'metal.applyTo:primary': 'Start, Export and Import.',
  'metal.applyTo:floating': 'Quick settings and back to top.',
  'background.type:animated': 'ShaderGradient (3D).',
  'background.type:dither': 'A 3D sphere in the page header, with a lens that follows your cursor.',
  'glass.mode:off': 'Solid surfaces.',
  'glass.mode:blur': 'CSS backdrop blur. Works in every modern browser.',
  'glass.mode:refraction': 'Blur plus a lens at the edges (SVG displacement).',
  'glass.mode:liquid': 'Samples the page once, so it goes stale over moving backgrounds.',
  'glass.applyTo:navbar': 'The tab bar and "More" panel on phones.',
  'nav.transition:reveal': 'The new page opens inside a soft disc that grows from where you pressed.',
  'nav.transition:wash': 'An accent-tinted disc covers the page, the page changes underneath, then the disc fades.',
  'nav.transition:none': 'Change instantly.',
}

/** One line under each section heading. */
export const sectionHelp: Record<SectionId, string> = {
  appearance: 'Preset, colours, type and shape.',
  background: 'What sits behind the pages, and how hard the 3D works.',
  glass: 'Frosted and refracting surfaces on the header, the phone tab bar, cards and buttons.',
  hud: 'Frame, brackets, grid, caption and the header orb.',
  navigation: 'The page-change animation, and the tab bar on phones.',
  motion: 'How much moves, and how fast.',
  diagnostics: 'Preview another date and time, or count frames.',
  data: 'Back up, restore or reset your settings and progress.',
}
