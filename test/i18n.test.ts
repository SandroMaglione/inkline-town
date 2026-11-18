import assert from "node:assert/strict"
import { test } from "node:test"
import { goods, grounds, kinds, props } from "../src/game/content/index.ts"
import { guideSteps } from "../src/game/rules/guide.ts"
import { detectLanguage, translate } from "../src/i18n/index.ts"
import { french } from "../src/i18n/fr.ts"

test("language preference wins over ordered browser languages, with regional matching and English fallback", () => {
  assert.equal(detectLanguage("en", ["fr-FR"]), "en")
  assert.equal(detectLanguage("fr", ["en-US"]), "fr")
  assert.equal(detectLanguage(null, ["fr-CA", "en-US"]), "fr")
  assert.equal(detectLanguage(null, ["FR-fr"]), "fr")
  assert.equal(detectLanguage(null, ["de-DE", "fr-FR", "en"]), "fr")
  assert.equal(detectLanguage(null, ["en-GB", "fr"]), "en")
  assert.equal(detectLanguage("obsolete", ["fr-CH"]), "fr")
  assert.equal(detectLanguage(null, ["ja-JP"]), "en")
  assert.equal(detectLanguage(null, []), "en")
})

test("French translates dynamic readouts without touching English, unknown text or numeric formatting", () => {
  assert.equal(translate("110 residents · 3 of 6", "fr"), "110 habitants · 3 sur 6")
  assert.equal(translate(" 10 coins ", "fr"), " 10 pièces ")
  assert.equal(translate("wood · planks · 12:45", "fr"), "bois · planches · 12:45")
  assert.equal(translate("Build a fishery", "fr"), "Construire : pêcherie")
  assert.equal(translate("110 residents", "en"), "110 residents")
  assert.equal(translate("more games by the maker of Inkline Town", "fr"), "more games by the maker of Inkline Town")
  assert.equal(translate("constructor", "fr"), "constructor")
  assert.equal(translate("unknown message", "fr"), "unknown message")
  assert.equal(translate("A $& town ", "fr"), "A $& town ")
  assert.equal(translate("Time left in the term\nThe almanac: the coming winter is normal, the one after mild.", "fr"),
    "Temps restant dans le mandat\nAlmanach : prochain hiver normal, puis doux.")
})

test("every guide action, explanation and completion condition is translated, retaining interactive references", () => {
  for (const step of guideSteps) {
    for (const source of [step.action, step.why, step.goal]) {
      const translated = translate(source, "fr")
      assert.notEqual(translated, source, `${step.id}: ${source}`)
      assert.deepEqual(translated.match(/\[[a-z:]+\]/g), source.match(/\[[a-z:]+\]/g), `${step.id}: interactive references`)
    }
  }
})

test("the content catalogue covers descriptions and goods, including every building upgrade", () => {
  for (const piece of [...Object.values(kinds), ...Object.values(grounds), ...Object.values(props)]) {
    assert.notEqual(translate(piece.blurb, "fr"), piece.blurb, piece.title)
  }
  for (const kind of Object.values(kinds)) {
    let up = kind.upgrade
    while (up) {
      assert.notEqual(translate(up.blurb, "fr"), up.blurb, up.title)
      up = up.next
    }
  }
  for (const good of Object.values(goods)) assert.notEqual(translate(good.title, "fr"), good.title)
})

test("translations keep every interpolation slot and do not invent placeholders", () => {
  const slots = (text: string) => [...new Set([...text.matchAll(/\{(\d+)(?::number)?\}/g)].map((match) => match[1]))].sort()
  for (const [source, target] of Object.entries(french)) assert.deepEqual(slots(target), slots(source), source)
})
