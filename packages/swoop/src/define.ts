/** Side-effect entry: `import '@swoopads/sdk/define'` registers <swoop-ad-slot> (and <gully-ad-slot>, the older name). */
import { defineAdSlot, GullyAdSlot, AD_SLOT_TAG } from './slot'

export const SWOOP_AD_SLOT_TAG = 'swoop-ad-slot'
/** same element under the Swoop name (a custom element class can be registered once, so the alias is a subclass) */
export class SwoopAdSlot extends GullyAdSlot {}

defineAdSlot()
if (typeof customElements !== 'undefined' && !customElements.get(SWOOP_AD_SLOT_TAG)) customElements.define(SWOOP_AD_SLOT_TAG, SwoopAdSlot)

export { defineAdSlot, GullyAdSlot, AD_SLOT_TAG }
