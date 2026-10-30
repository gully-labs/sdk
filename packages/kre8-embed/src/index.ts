/**
 * @gullylabs/kre8-embed: embeddable kre8.fun web components (coin card, player, Back this) rendered in a sandboxed
 * iframe served from kre8.fun, plus a read-only public data client. Importing this entry registers nothing; call
 * defineKre8Embeds() or import '@gullylabs/kre8-embed/define'.
 */
export { BACK_BUTTON_TAG, COIN_CARD_TAG, defineKre8Embeds, Kre8BackButtonElement, Kre8CoinCardElement, Kre8PlayerElement, PLAYER_TAG } from './elements'
export { createEmbedFrame, defaultTitle, IFRAME_REFERRER_POLICY, IFRAME_SANDBOX, openKre8, type FrameHandle, type FrameOptions } from './frame'
export { ALLOWED_EMBED_ORIGINS, DEFAULT_EMBED_ORIGIN, DEFAULT_INDEXER_URL, DEFAULT_SOCIAL_URL, GULLY_CHAIN_ID, isDevOrigin, originOf, resolveEmbedOrigin, type EmbedOriginOptions } from './origins'
export { acceptEmbedEvent, isSafeOpenHref, parseEmbedMessage, PROTOCOL_VERSION, type EmbedMessage, type MessageEventLike } from './protocol'
export {
  backUrl,
  buildEmbedSrc,
  coinUrl,
  EMBED_KINDS,
  EMBED_SIZE,
  isCoinAddress,
  isCreatorRef,
  isHandle,
  isNonce,
  isTrackId,
  isValidEmbedId,
  isVideoId,
  kitIconUrl,
  kitWordmarkUrl,
  newNonce,
  type EmbedKind,
  type EmbedSrcOptions,
} from './url'
export {
  createKre8Client,
  Kre8ApiError,
  parseCandles,
  parseCoin,
  parseCoinCard,
  parseCreator,
  parseProfile,
  parseTrack,
  type FetchLike,
  type Kre8Candle,
  type Kre8Client,
  type Kre8ClientOptions,
  type Kre8Coin,
  type Kre8CoinCard,
  type Kre8Creator,
  type Kre8Profile,
  type Kre8Track,
  type Kre8TrendingCreator,
  type WindowKey,
} from './client'
