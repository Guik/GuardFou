import { normalize } from './brands.js';

/**
 * True when the registrar name matches one of the watched registrars (case/
 * accent-insensitive substring match, e.g. "Realtime Register B.V." matches
 * "realtime register").
 * @param {string|null} registrarName
 * @param {string[]} watchedRegistrars lowercase, normalized names/fragments
 */
export function isWatchedRegistrar(registrarName, watchedRegistrars) {
  if (!registrarName) return false;
  const normalizedName = normalize(registrarName);
  return watchedRegistrars.some((watched) => normalizedName.includes(normalize(watched)));
}
