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

export interface RangeUse {
  /** How far the range display fell over the shift. */
  rangeUsed: number
  /**
   * Miles driven, as the range drop implies.
   *
   * This is the sturdy figure here: it needs no mpg at all. The dash computes
   * range as its own recent-average mpg times the fuel it senses, so when that
   * average holds steady over a shift the range falls mile for mile with the
   * odometer — whatever the average happens to be.
   */
  miles: number
  /**
   * Fuel that accounts for. Unlike the miles, this only holds if the mpg passed
   * in is the one the car is using; an EPA figure against a car averaging
   * something else gives the wrong gallons from the right range.
   */
  gallons: number
  mpg: number
  /** Null when no pump price is known yet. */
  cost: number | null
  /** The range ended higher than it started, so fuel went in during the shift. */
  refuelled: boolean
  /**
   * Range the fill-up put back, which is what makes a mid-shift stop readable
   * rather than fatal to the estimate.
   */
  rangeAdded: number
  /**
   * The readings cannot be made to balance — the range rose with no fuel
   * accounted for, or more rose than the fuel bought explains. Every figure is
   * zero in that case rather than guessed at.
   */
  unexplained: boolean
  /**
   * The miles came from readings alone, with no pump price involved.
   *
   * Worth flagging because the alternative is not merely less tidy: backing the
   * gallons out of dollars uses the last price the app saw, and the same $40
   * against a price that has since moved thirty cents swings the answer by
   * about forty miles.
   */
  measured: boolean
}

/**
 * The dash on both sides of a fill-up: what it read pulling in, and what it
 * read pulling away.
 *
 * Both are needed, and that is less obvious than it looks — either one on its
 * own cancels out of the arithmetic and leaves the estimate right back on the
 * pump price. With the pair, what was burned is just the two legs added.
 */
export interface PumpStop {
  atPump: number
  afterPump: number
}

/**
 * What a shift used, read off the range display before and after.
 *
 * Two numbers off the dash are far easier to capture than an odometer pair, and
 * they answer the question a gig driver actually has — what did tonight cost to
 * run — without needing a fill-up to have happened at all.
 *
 * The estimate degrades honestly: the miles hold whatever the mpg, the gallons
 * need the right mpg, and the cost needs a price as well. Each is reported
 * separately so a missing input removes one figure rather than corrupting all
 * three.
 */
export function fuelFromRange(
  rangeBefore: number,
  rangeAfter: number,
  mpg: number,
  pricePerGallon?: number,
  /**
   * Fuel put in during the shift. Stopping at the pump mid-shift raises the
   * range, which would otherwise make the whole reading unusable — knowing how
   * much went in puts it back on its feet.
   */
  gallonsAdded = 0,
  /** The dash on both sides of the fill, when it was noted. */
  stop?: PumpStop,
): RangeUse {
  const safeMpg = mpg > 0 ? mpg : 1
  const added = Math.max(gallonsAdded, 0)

  // Two readings at the pump beat any amount of arithmetic: the range the fuel
  // bought is simply the jump between them, so nothing needs converting.
  const measured = !!stop
  const rangeAdded = stop ? stop.afterPump - stop.atPump : added * safeMpg

  // What was burned is what the tank started with, plus what went in, less
  // what is left — the same conservation the odometer would show. With a
  // measured stop it reduces to the two legs added, which is the same sum
  // written without the middle terms.
  const drop = rangeBefore + rangeAdded - rangeAfter
  const refuelled = stop ? stop.afterPump > stop.atPump : rangeAfter > rangeBefore
  // Either the range rose with nothing to explain it, or more rose than the
  // fuel bought accounts for. With a stop, a leg running backwards says the
  // same thing: the readings do not describe one shift. Nothing is reported
  // rather than a figure that merely looks computed.
  const legsBackwards = stop
    ? stop.atPump > rangeBefore || rangeAfter > stop.afterPump
    : false
  const unexplained = drop < 0 || legsBackwards

  const rangeUsed = unexplained ? 0 : drop
  const gallons = rangeUsed / safeMpg
  return {
    rangeUsed,
    miles: rangeUsed,
    gallons,
    mpg: safeMpg,
    cost: pricePerGallon && pricePerGallon > 0 ? gallons * pricePerGallon : null,
    refuelled,
    rangeAdded: unexplained ? 0 : rangeAdded,
    unexplained,
    measured,
  }
}
