/**
 * The land a charter makes never changes with the code under it: these are
 * fingerprints of the land made for each size and richness, recorded before
 * the coast's capes measured their angle with `Angle.wrap` (they used
 * `atan2(sin, cos)`, which differs in the last bit; no land changed).
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"

import type { LandId, SizeId } from "../src/game/content/index.ts"
import { generate } from "../src/game/world/mapgen.ts"

const lands: ReadonlyArray<readonly [SizeId, LandId, number, string]> = [
  ["small", "rich", 0, "80b76f3676e79d34bc951f71e7caf354e0e0ef83"],
  ["small", "rich", 1, "382478a9f3eaab64ba20cc2fd77efe84725607e4"],
  ["small", "fair", 0, "0ea63bdd08fe9b07537b661f68134719cf5062c9"],
  ["small", "fair", 1, "996966e3170bc58d36b0007dab0e398151f647c0"],
  ["small", "harsh", 0, "09b0de169c0812b47e5e6fecd89ef4939737dd0b"],
  ["small", "harsh", 1, "71837e2248017648babe7e7941c46e8ccc99b2bc"],
  ["medium", "rich", 0, "1e10f634ecb65c32555a7145090254a6ef27c204"],
  ["medium", "rich", 1, "197d7c69ed9d26fb476ac3855ae9a802a192e2f7"],
  ["medium", "fair", 0, "5f01502c1b1b39ed9dd0a661f0130baf87d23de2"],
  ["medium", "fair", 1, "e0adc8513ab35adab23cb5e4eb91ef6153c53aea"],
  ["medium", "harsh", 0, "6e1cdb5bf3f0d6d1fe62287ce8ea3238309e5901"],
  ["medium", "harsh", 1, "4cbf9edd35e06a65a5459685fe4db027895bbf97"],
  ["large", "rich", 0, "426a04a726639bdc6cfb808886929ebc485e3b29"],
  ["large", "rich", 1, "15a0f3885d4c6000a29dc0b94e4a95a941bac50a"],
  ["large", "fair", 0, "461d36e9ba6af37e2f9184912bf054e2f0d3e7ec"],
  ["large", "fair", 1, "ca95d68c071871a1ed9783e9802bd59ba17c7bd0"],
  ["large", "harsh", 0, "f064178c9619d373e457b2fb78a83f93ba443931"],
  ["large", "harsh", 1, "8a665d9974ba92136108b57ca936559628bf1cc6"]
]

test("every charter makes the same land as before", () => {
  for (const [size, land, seed, fingerprint] of lands) {
    const made = createHash("sha1").update(JSON.stringify(generate({ size, land, seed, term: 45 }))).digest("hex")
    assert.equal(made, fingerprint, `${size}, ${land} land, seed ${seed}`)
  }
})
