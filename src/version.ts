/**
 * Which version of the app this is, and what each one changed.
 *
 * The build stamp answers "did the update land". It cannot answer "what did I
 * get" or "am I behind", because `2026-09-23 17:44 UTC · d00dbbd` is not
 * something anyone can compare at a glance on a phone. A number is.
 *
 * When to bump which part:
 *
 *   MAJOR  something can now be done that could not be done before — a new
 *          tab, a new calculator, a new kind of record kept.
 *   MINOR  everything else: corrections to the figures, bug fixes, and
 *          refinements to what is already there.
 *
 * Newest first. Add to the top; never edit or renumber a release that has
 * shipped, because a device out there is holding that number and the only
 * thing that makes it meaningful is that it never moves.
 */
export interface Release {
  /** MAJOR.MINOR. */
  version: string
  /** ISO date it went out. */
  date: string
  /** One line, in terms of what changed on screen rather than in the code. */
  headline: string
}

export const RELEASES: readonly Release[] = [
  {
    version: '4.6',
    date: '2026-09-23',
    headline: 'Version numbers, so you can tell what you have and what changed',
  },
  {
    version: '4.5',
    date: '2026-09-23',
    headline: 'Read the dash on both sides of a mid-shift fill-up',
  },
  {
    version: '4.4',
    date: '2026-09-21',
    headline: 'Price a shift from the range before and after; Amazon is a Klarna plan',
  },
  {
    version: '4.3',
    date: '2026-09-18',
    headline: 'Delta, Amazon and Frontier corrected; fuel spread across the shifts that burned it',
  },
  {
    version: '4.2',
    date: '2026-09-17',
    headline: 'Deployed updates actually reach the phone',
  },
  {
    version: '4.1',
    date: '2026-09-17',
    headline: 'What is owed to people, tracked line by line',
  },
  {
    version: '4.0',
    date: '2026-09-16',
    headline: 'A fuel calculator for the 2010 Acura TL',
  },
  {
    version: '3.5',
    date: '2026-09-16',
    headline: 'Ten bugs fixed, nine gaps closed, seven features added',
  },
  {
    version: '3.4',
    date: '2026-09-15',
    headline: 'Past payments on the calendar; editing a shift made findable',
  },
  {
    version: '3.3',
    date: '2026-09-11',
    headline: 'Sunday-to-Saturday weeks; unemployment recorded as ended',
  },
  {
    version: '3.2',
    date: '2026-09-10',
    headline: 'Progress chart, pay-from-calendar, and a what-if slider',
  },
  {
    version: '3.1',
    date: '2026-09-10',
    headline: 'Runway, living costs, a price tag on the strategy, and a weekly earn target',
  },
  {
    version: '3.0',
    date: '2026-09-09',
    headline: 'Gig shifts with net profit, and a box that reads plain sentences',
  },
  {
    version: '2.2',
    date: '2026-09-06',
    headline: 'A month grid on the calendar',
  },
  {
    version: '2.1',
    date: '2026-09-04',
    headline: 'Due dates settle themselves; newer figures offered to older devices',
  },
  {
    version: '2.0',
    date: '2026-08-28',
    headline: 'Payments logged against a debt, and a calendar of what is due',
  },
  {
    version: '1.1',
    date: '2026-08-28',
    headline: 'Confirmed balances as the source of truth; a keep-in-checking share',
  },
  {
    version: '1.0',
    date: '2026-08-13',
    headline: 'Income, debt payoff and savings, installable to the phone',
  },
]

/**
 * Derived from the list rather than kept beside it. A version written down
 * twice is a version that will disagree with itself.
 */
export const APP_VERSION = RELEASES[0].version

/** Sorts MAJOR.MINOR properly: 4.10 is above 4.9, where a string compare is not. */
export function compareVersions(a: string, b: string): number {
  const [aMajor = 0, aMinor = 0] = a.split('.').map(Number)
  const [bMajor = 0, bMinor = 0] = b.split('.').map(Number)
  return aMajor - bMajor || aMinor - bMinor
}

/**
 * What arrived since the version this device last showed.
 *
 * An unrecognised version — never stamped, or from a build newer than this
 * one — yields just the current release. It is the one thing that can be said
 * truthfully without knowing where the device came from.
 */
export function releasesSince(seen?: string): Release[] {
  if (!seen) return [RELEASES[0]]
  const at = RELEASES.findIndex((r) => r.version === seen)
  if (at < 0) return [RELEASES[0]]
  return RELEASES.slice(0, at)
}
