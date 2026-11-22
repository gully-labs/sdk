// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as swoop from '../../swoop/src/index'
import * as swoopServer from '../../swoop/src/server'
import * as old from '../src/index'
import * as oldServer from '../src/server'

describe('@gullylabs/ads keeps working as a re-export of @swoopads/sdk', () => {
  it('exposes every export of the new package from the old entry', () => {
    for (const k of Object.keys(swoop)) expect(Object.keys(old)).toContain(k)
    expect(old.GullyAds).toBe(swoop.GullyAds)
    expect(old.SwoopAds).toBe(swoop.GullyAds)
    expect(old.mountUnit).toBe(swoop.mountUnit)
  })
  it('exposes the server helpers from the old server entry', () => {
    for (const k of Object.keys(swoopServer)) expect(Object.keys(oldServer)).toContain(k)
    expect(oldServer.signServeRequest).toBe(swoopServer.signServeRequest)
  })
})
