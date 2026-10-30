/**
 * The <script> build (dist/kre8-embed.global.js): registers the elements on load and exposes everything from the main
 * entry as window.Kre8Embed.
 */
import * as api from './index'

api.defineKre8Embeds()

export * from './index'
