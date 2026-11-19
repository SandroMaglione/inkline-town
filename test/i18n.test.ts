import assert from "node:assert/strict"
import { test } from "node:test"
import { goods, grounds, kinds, props, ranks } from "../src/game/content/index.ts"
import { guideSteps } from "../src/game/rules/guide.ts"
import { upgradeBlock } from "../src/game/schedule.ts"
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

test("French translates composed workplace, upgrade, and chronicle messages", () => {
  const examples = [
    ["2 short of workers: fishery 0/2 (nobody within reach), sawmill 1/2 · click the jobs counter to visit them",
      "2 bâtiments manquent de travailleurs : pêcherie 0/2 (personne à portée), scierie 1/2 · cliquez sur le compteur d'emplois pour les visiter"],
    ["the mills wait on wheat: the farm can become an estate. {Tap|Click} it, under its gold arrow, to begin",
      "les moulins attendent du blé : ferme peut devenir domaine. {Touchez|Cliquez sur} le bâtiment sous la flèche dorée pour commencer"],
    ["Fire on Mill Lane: two homes and one building lost.",
      "Incendie (ruelle de Moulin) : deux maisons et un bâtiment détruits."],
    ["A hard winter, year 2: the fields lie still and fisheries catch 30%; homes burn fires to keep warm.",
      "Hiver rigoureux de l'année 2 : les champs ne poussent plus, les pêcheries produisent à 30 % et les maisons se chauffent au feu."],
    ["fishery → market · 400 coins now", "pêcherie → marché · 400 pièces maintenant"],
    ["wood → planks", "bois → planches"],
    ["park +2 desirability (now +1)", "attrait du parc +2 (actuellement +1)"],
    ["no workers for the fishery ×2, sawmill: lay [homes] within 15 road cells of it, or a road to homes nearby",
      "aucun travailleur pour pêcherie ×2, scierie : construisez des [homes] à moins de 15 cases de route ou reliez les maisons proches"],
    ["no trees within 3 cells", "aucun arbre à moins de 3 cases"],
    ["winter in 0:30 (hard)", "hiver dans 0:30 (rigoureux)"],
    ["Could not share the town: Too many shares at once: wait a minute and try again",
      "Impossible de partager la ville : Trop de partages simultanés : patientez une minute et réessayez"]
  ] as const
  for (const [source, expected] of examples) {
    assert.equal(translate(source, "fr"), expected)
    assert.equal(translate(source, "en"), source)
  }
})

test("French translates each part of building help", () => {
  const help = [
    "Upkeep is paid every minute it stands, a quarter of it while paused.",
    "Everything wears down; a builder's yard mends it.",
    "It changes how nice the streets are out to 3 cells."
  ].join("\n")
  assert.equal(translate(help, "fr"), [
    "L'entretien est payé chaque minute, ou au quart en pause.",
    "Tout s'use ; un atelier de maçon assure les réparations.",
    "Modifie l'attrait des rues dans un rayon de 3 cases."
  ].join("\n"))
})

test("town hall upgrade rank requirements are translated", () => {
  const first = kinds.townhall.upgrade!
  const second = first.next!
  const village = upgradeBlock(first, 0, { ranks })!
  const town = upgradeBlock(second, 1, { ranks })!
  assert.equal(translate(village, "fr"), "la ville doit atteindre le rang village")
  assert.equal(translate(town, "fr"), "la ville doit atteindre le rang ville")
  assert.equal(translate(village, "en"), village)
  assert.equal(translate(`${first.title} ${village}`, "fr"), "pour améliorer Maison des guildes, la ville doit atteindre le rang village")
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
  for (const good of Object.values(goods)) assert.equal(translate(`3 ${good.title}`, "fr"), `3 ${translate(good.title, "fr")}`)
})

test("translations keep every interpolation slot and do not invent placeholders", () => {
  const slots = (text: string) => [...new Set([...text.matchAll(/\{(\d+)(?::number)?\}/g)].map((match) => match[1]))].sort()
  for (const [source, target] of Object.entries(french)) assert.deepEqual(slots(target), slots(source), source)
})
