// Side-effect entry: `import '@gullylabs/security/badge.js'` defines <gully-security-badge> with the defaults.
import { defineSecurityBadge } from './badge-element'

defineSecurityBadge()

export { defineSecurityBadge, GullySecurityBadgeElement, BADGE_TAG, BADGE_SIZES, BADGE_FILES } from './badge-element'
export type { BadgeSize, BadgeTheme, BadgeData, SecurityBadgeDefaults, SecurityBadgeState } from './badge-element'
