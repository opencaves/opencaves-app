// A cave page's Nearby caves (CavePage), the same on the server
// (src/ssr/pageState.js, which sends them) and in the browser: links search
// engines follow from cave to cave.

import { distanceMetres } from './geoDistance.js'

// How many, and how far at most (metres).
const NEARBY_COUNT = 6
const NEARBY_MAX_M = 20000

const point = (location) => (location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)) && (Number(location.latitude) || Number(location.longitude)) ? { latitude: Number(location.latitude), longitude: Number(location.longitude) } : null)

/**
 * The named caves nearest a cave ({@link NEARBY_COUNT} at most, within
 * {@link NEARBY_MAX_M}), nearest first, each with its distance and its
 * system's name. None when the cave has no position.
 *
 * @param {Cave} cave
 * @param {Cave[]} caves - Every cave (with their positions).
 * @param {(sistemaId: string) => string|null|undefined} sistemaName - A public system's name.
 * @returns {{id: string, name: string, distance: number, sistema: string|null}[]} distance in metres.
 */
export function nearbyCaves(cave, caves, sistemaName) {
  const here = point(cave?.location)
  if (!here) return []
  return caves
    .map((other) => {
      const name = (typeof other.name === 'string' ? other.name : other.name?.value)?.trim()
      const there = other.id !== cave.id && name ? point(other.location) : null
      return there && { id: other.id, name, distance: Math.round(distanceMetres(here, there)), sistema: (other.sistemaId && sistemaName(other.sistemaId)) || null }
    })
    .filter((other) => other && other.distance <= NEARBY_MAX_M)
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
    .slice(0, NEARBY_COUNT)
}
