/**
 * Pictures in the panels and menus are the map's own models (see
 * `pictureAsset`): every kind at every level of upgrades, every home, every
 * piece of park is pictured through the function the map draws it with, so
 * no picture is left behind when a model changes.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { groundIds, kindIds, kinds, propIds } from "../src/content.ts"
import { buildingAsset, homeAsset, noDoors, pictureAsset } from "../src/render3d/models.ts"

test("every building's picture, at every level of upgrades, is the model the map draws", () => {
  for (const id of kindIds) {
    const top = kinds[id].upgrade?.next ? 2 : kinds[id].upgrade ? 1 : 0
    for (let level = 0; level <= top; level++) {
      const pictured = pictureAsset(id, level)
      assert.ok(pictured.faces.length > 0, `${id} ${level} has a picture`)
      assert.deepEqual(pictured, buildingAsset(id, 1, null, { ...noDoors, right: true, left: true }, 0, {}, level), `${id} at level ${level}`)
    }
  }
})

test("every home's picture is the model the map draws", () => {
  for (const tier of [1, 2, 3] as const) assert.deepEqual(pictureAsset(tier), homeAsset(tier, 0, 1, null, { ...noDoors, right: true }))
})

test("every piece of park is pictured as the map draws it, a furnishing standing on its ground", () => {
  for (const ground of groundIds) assert.ok(pictureAsset(`park:${ground}`).faces.length > 0, ground)
  for (const prop of propIds) {
    const bare = pictureAsset(`park:${prop === "lamp" ? "path" : "square"}`)
    assert.ok(pictureAsset(`park:${prop}`).faces.length > bare.faces.length, `${prop} stands on its ground`)
  }
})

test("the page pictures nothing any other way", () => {
  const host = readFileSync(new URL("../src/host.ts", import.meta.url), "utf8")
  assert.match(host, /pictureAsset\(/)
  for (const other of ["drawParkPiece", "makeBuilding", "serviceBuilding", "dressedBuilding"]) assert.equal(host.includes(other), false, `host.ts pictures with ${other}`)
})
