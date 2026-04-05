// state.js — URL state serialization / deserialization
// Requires lz-string to be loaded before this script.
//
// Phase 4 implementation: encode/decode full game state to/from the URL hash.

/**
 * Encode the game state object to a URL-safe compressed string.
 * @param {object} state
 * @returns {string}
 */
function encodeState(state) {
  const json = JSON.stringify(state);
  // LZString compresses JSON then base64-encodes it for URL safety
  return LZString.compressToEncodedURIComponent(json);
}

/**
 * Decode a URL-safe compressed string back to a game state object.
 * @param {string} encoded
 * @returns {object}
 */
function decodeState(encoded) {
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (!json) throw new Error('Failed to decompress state');
  return JSON.parse(json);
}
