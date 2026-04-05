# Collabble — Design Specification

> Living design doc. Update this as decisions are made or refined during development.

---

## Overview

**Collabble** is a two-player *cooperative* word tile game played in a web browser. It follows the basic rules of Scrabble, but instead of competing, both players work *together* to maximize a single shared score.

- No server, no database
- Game state is encoded in the URL so players can pass turns by sharing a link
- Both players can see each other's tiles (with an optional "blind mode")

**URL**: `hfionte.github.io/collabble/`

---

## Rules Summary

- Standard 15×15 Scrabble board with premium squares (DL, TL, DW, TW)
- Standard 100-tile English letter bag (A×9, B×2, ... Z×1, BLANK×2)
- Each player holds 7 tiles at a time
- Players alternate turns; on your turn you may:
  - **Place** one or more tiles to form a valid word
  - **Exchange** any tiles from your hand (forfeit turn, draw new tiles)
  - **Pass** (forfeit turn without drawing)
- All words formed in a single play must be valid (checked against TWL/SOWPODS dictionary)
- Score from both players' plays is added to a **single shared total**
- **Bingo bonus**: +50 points for using all 7 tiles in one play
- First word played must cover the center star (★ at [7][7])
- Game ends when the tile bag is empty and neither player can play, or both players pass consecutively

---

## Board Layout

Standard 15×15 Scrabble board. Premium square positions (0-indexed, row × col):

### Triple Word (TW) — Red
```
(0,0) (0,7) (0,14)
(7,0)       (7,14)
(14,0)(14,7)(14,14)
```

### Double Word (DW) — Pink (includes center ★)
```
Diagonal from corners toward center:
(1,1)(2,2)(3,3)(4,4)       and mirrors
(5,5) (center is ★)
(1,13)(2,12)(3,11)(4,10)   and mirrors
```
Full list: (1,1),(2,2),(3,3),(4,4),(10,10),(11,11),(12,12),(13,13),(1,13),(2,12),(3,11),(4,10),(10,4),(11,3),(12,2),(13,1)

### Triple Letter (TL) — Dark Blue
(1,5),(1,9),(5,1),(5,5),(5,9),(5,13),(9,1),(9,5),(9,9),(9,13),(13,5),(13,9)

### Double Letter (DL) — Light Blue
(0,3),(0,11),(2,6),(2,8),(3,0),(3,7),(3,14),(6,2),(6,6),(6,8),(6,12),(7,3),(7,11),(8,2),(8,6),(8,8),(8,12),(11,0),(11,7),(11,14),(12,6),(12,8),(14,3),(14,11)

### Center Star (★)
(7,7) — counts as DW, first play must include this square

---

## Tile Distribution & Values

| Letter | Count | Points | Letter | Count | Points |
|--------|-------|--------|--------|-------|--------|
| A | 9 | 1 | N | 6 | 1 |
| B | 2 | 3 | O | 8 | 1 |
| C | 2 | 3 | P | 2 | 3 |
| D | 4 | 2 | Q | 1 | 10 |
| E | 12 | 1 | R | 6 | 1 |
| F | 2 | 4 | S | 4 | 1 |
| G | 3 | 2 | T | 6 | 1 |
| H | 2 | 4 | U | 4 | 1 |
| I | 9 | 1 | V | 2 | 4 |
| J | 1 | 8 | W | 2 | 4 |
| K | 1 | 5 | X | 1 | 8 |
| L | 4 | 1 | Y | 2 | 4 |
| M | 2 | 3 | Z | 1 | 10 |
| BLANK | 2 | 0 | | | |

---

## Multiplayer Model (URL State Passing)

Since there is no server, the full game state is serialized and embedded in the URL on every turn.

### URL Format
```
hfionte.github.io/collabble/#<lz-base64-compressed-state>
```

The hash fragment contains the entire game state compressed with [LZ-String](https://pieroxy.net/blog/pages/lz-string/index.html) and base64-encoded. Estimated URL length: **350–500 characters** (well within sharing limits for iMessage, email, etc.).

### State Schema (v1)
```js
{
  version: 1,
  gameId: string,          // short random ID for localStorage keying
  turn: "P1" | "P2",
  board: string[][],       // 15×15; "." = empty, "A"-"Z" = tile, "a"-"z" = blank played as letter
  bag: object,             // { "A": 7, "B": 2, ..., "BLANK": 1 } remaining counts
  hands: {
    P1: string[],          // e.g. ["A", "BLANK", "T", "E", "S", "T", "S"]
    P2: string[]
  },
  score: number,           // combined total score
  lastMove: {              // for highlighting squares just played
    cells: [row, col][],
    words: string[],
    points: number
  } | null,
  consecutivePasses: number,
  gameOver: boolean
}
```

### Turn Flow

```
1. New game
   P1 visits /collabble/  →  fresh state created  →  URL updated to #<state>
   P1 copies URL and sends to P2 so they know the gameId

2. P1's turn
   P1 places tiles  →  clicks "End Turn"
   →  state updated (board, hands, bag, score, turn="P2")
   →  URL updates  →  copy prompt appears
   P1 copies URL  →  sends to P2

3. P2's turn
   P2 opens link  →  state decoded from hash
   →  board shows P1's move, P2's rack is active
   P2 plays  →  "End Turn"  →  new URL  →  sends back to P1

4. Repeat until game over

5. localStorage
   On each state update: localStorage.setItem(gameId, serializedState)
   On page load with no hash: check localStorage for recent game (offer to resume)
```

---

## UI Layout

### Desktop (≥768px)
```
┌──────────────────────────────────────────────────────┐
│  ✦ Collabble          Score: 247     Turn: Player 2  │
├───────────────────────┬──────────────────────────────┤
│                       │  Your Rack (Player 2)        │
│                       │  ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐     │
│    15 × 15 Board      │  │A││B││C││D││E││F││G│     │
│                       │  └─┘└─┘└─┘└─┘└─┘└─┘└─┘     │
│                       │                              │
│  (cells color-coded   │  Partner's Rack (Player 1)  │
│   by premium type)    │  ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐     │
│                       │  │?││?││?││?││?││?││?│  👁  │
│                       │  └─┘└─┘└─┘└─┘└─┘└─┘└─┘     │
│                       │                              │
│                       │  [ End Turn ]  [ Exchange ]  │
│                       │  [ Pass     ]  [ Copy URL ]  │
└───────────────────────┴──────────────────────────────┘
```

### Mobile
Board and rack stack vertically. Rack displays below board.

---

## Interactions

| Action | How |
|--------|-----|
| Select a tile | Click tile in rack → tile highlights |
| Place a tile | Click empty board square → tile moves from rack to board |
| Recall a tile | Click a tile on the board (placed this turn) → returns to rack |
| Play a blank | Selecting a blank tile → modal to choose which letter it represents |
| End Turn | Click "End Turn" → validation runs → score updates → URL generated → copy prompt |
| Copy URL | Click "Copy URL" → URL copied to clipboard → button shows ✓ |
| Exchange tiles | Click "Exchange" → select tiles to swap → confirm → draw replacements, turn ends |
| Pass | Click "Pass" → turn passes without drawing |
| Blind mode | Click eye icon (👁) next to partner rack → tiles shown as blank backs |

---

## Dictionary

- **Source**: TWL06 (Tournament Word List) — standard North American Scrabble dictionary
- **Format**: Bundled as `wordlist.js` — a JavaScript file exporting a `Set` of valid words (all lowercase)
- **Size**: ~178,000 words, ~1.6MB unminified, ~500KB gzip (loaded once, cached by browser)
- **Validation logic**:
  1. After tiles are placed, scan all rows and columns that contain newly placed tiles
  2. Find all contiguous letter runs of length ≥ 2 that include at least one new tile
  3. Check each run against `WORDS`; if any fails → reject play, highlight invalid word(s)

---

## Scoring

- Each letter's base value × any DL/TL multiplier on its square
- Sum of all letter values × any DW/TW multiplier on any square in the word
- Premium squares only apply to tiles placed *this turn* (existing tiles on DL/TL/DW/TW squares are not re-multiplied)
- Multiple words formed in one play each score independently
- **Bingo**: +50 points if all 7 tiles are used in one turn
- All points added to the shared score

---

## File Structure

```
collabble/
├── index.html      — App shell, all modals, layout skeleton
├── styles.css      — Board, tiles, rack, responsive layout, animations
├── game.js         — Game logic, state machine, event handlers, rendering
├── state.js        — Serialize/deserialize game state (LZ-string ↔ URL hash)
├── wordlist.js     — TWL word set: export const WORDS = new Set([...])
└── DESIGN.md       — This document
```

LZ-String loaded via CDN (`https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js`) or bundled inline.

---

## Out of Scope (v1)

- Undo after a turn has been submitted
- In-game chat / messaging
- Per-turn timer
- Rematch / game history
- Single-player vs. computer
- Move suggestions or hints
- Accessibility (ARIA, keyboard navigation) — future enhancement
