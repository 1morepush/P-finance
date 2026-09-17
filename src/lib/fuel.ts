import type { Vehicle } from '../types'

/**
 * The EPA combined figure: 55% city, 45% highway, combined harmonically.
 *
 * Miles per gallon is a rate, so the two cannot simply be averaged — 18 and 26
 * average to 22, where the real combined figure is 20.9. A mile per gallon of
 * optimism is about $3 a tank.
 */
export function combinedMpg(v: Vehicle): number {
  return 1 / (0.55 / v.cityMpg + 0.45 / v.highwayMpg)
}

/** Which figure to divide the range by. */
export type DrivingMix = 'city' | 'combined' | 'highway' | 'observed'

export function mpgFor(v: Vehicle, mix: DrivingMix): number {
  if (mix === 'city') return v.cityMpg
  if (mix === 'highway') return v.highwayMpg
  if (mix === 'observed' && v.observedMpg && v.observedMpg > 0) return v.observedMpg
  return combinedMpg(v)
}

export interface FillEstimate {
  /** The figure the range was divided by. */
  mpg: number
  /** Fuel the range display is counting. */
  gallonsShown: number
  /** Fuel below the display's zero — it reads 0 with some still in the tank. */
  reserve: number
  /** Everything actually in the tank. */
  gallonsInTank: number
  /** What the pump would take. */
  gallonsToFill: number
  costToFill: number
  /** What the whole tank is worth at this price. */
  fullTankCost: number
  /** Miles a full tank goes at this mpg, reserve included. */
  fullTankMiles: number
  costPerMile: number
  /**
   * The range implies more fuel than the tank holds, so the mpg being divided
   * by is too low — the car is doing better than the figure assumes.
   */
  impossible: boolean
}

/**
 * What is left in the tank, and what filling it costs.
 *
 * The car's range display is its own recent-average mpg multiplied by the fuel
 * it senses, so dividing it back by a chosen mpg only recovers the gallons if
 * the two figures agree. That is why the mix is selectable and why an observed
 * average, read off the trip computer, beats any EPA number.
 *
 * The reserve matters more than it looks: the display reads 0 with a couple of
 * gallons still in, so treating "0 miles" as an empty tank overstates the fill
 * by about six dollars.
 */
export function estimateFill(
  v: Vehicle,
  rangeMiles: number,
  pricePerGallon: number,
  mpg: number,
): FillEstimate {
  const safeMpg = mpg > 0 ? mpg : combinedMpg(v)
  const range = Math.max(rangeMiles, 0)
  const price = Math.max(pricePerGallon, 0)
  const reserve = Math.max(v.reserveGallons, 0)

  const gallonsShown = range / safeMpg
  const gallonsInTank = gallonsShown + reserve
  const gallonsToFill = Math.max(v.tankGallons - gallonsInTank, 0)

  return {
    mpg: safeMpg,
    gallonsShown,
    reserve,
    gallonsInTank: Math.min(gallonsInTank, v.tankGallons),
    gallonsToFill,
    costToFill: gallonsToFill * price,
    fullTankCost: v.tankGallons * price,
    fullTankMiles: v.tankGallons * safeMpg,
    costPerMile: price / safeMpg,
    impossible: gallonsInTank > v.tankGallons + 0.005,
  }
}

/**
 * The mpg the range implies if the tank really is full — the figure to correct
 * `observedMpg` to when the display disagrees with the arithmetic.
 */
export function impliedMpg(v: Vehicle, rangeMiles: number): number {
  const usable = Math.max(v.tankGallons - Math.max(v.reserveGallons, 0), 0.01)
  return rangeMiles / usable
}

/** What a stretch of driving costs in fuel — a gig shift, priced before it starts. */
export function fuelCostFor(miles: number, costPerMile: number): number {
  return Math.max(miles, 0) * costPerMile
}
