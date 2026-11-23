/**
 * The languages. The compiler already holds every locale to English's
 * shape (a missing message, or one read with the wrong numbers, does not
 * build); these tests hold what types cannot: that each locale names every
 * upgrade the content has, that everything the simulation can say comes out
 * as words with only tokens the game knows, that a message reads the same
 * as markup's parts and as plain words, and that the language picked is the
 * one the reader asked for.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { goodIds, kindIds, kinds, ranks, upgradeAt, type GoodId, type KindId } from "../src/game/content/index.ts"
import { STREET_WAYS, type Event, type Lock, type Notice, type Place } from "../src/game/said.ts"
import { en, languageName, load, localeOf, locales, pick, plain, say, type Catalog } from "../src/i18n/index.ts"
import * as token from "../src/i18n/token.ts"
import { parse } from "../src/i18n/token.ts"
import { carriedOver, carryOver, prefer, preferred } from "../src/platform/language.ts"
import { commands, mapViews, type CommandId, type MapViewId } from "../src/view/tools.ts"

const catalogs: ReadonlyArray<Catalog> = await Promise.all(locales.map(load))

/** A message has no token left unread: nothing in square brackets that `parse` kept as text, nothing a template printed for want of words. */
const wellFormed = (t: Catalog, message: string, what: string) => {
  assert.ok(message.trim() !== "", `${t.locale} ${what}: says something`)
  assert.doesNotMatch(message, /\[object Object\]|undefined|NaN/, `${t.locale} ${what}: ${message}`)
  for (const part of parse(message)) if (part.type === "text") assert.doesNotMatch(part.text, /\[[a-z]+[:|\]]/, `${t.locale} ${what}: an unknown token in "${message}"`)
  assert.doesNotMatch(plain(t, message), /\[[a-z]+:/, `${t.locale} ${what}: plain words still hold a token`)
}

// ── Tokens ────────────────────────────────────────────────────────────────

test("a token written by its helper reads back as the part it names", () => {
  assert.deepEqual(parse(token.coins(25)), [{ type: "coins", n: 25, signed: false }])
  assert.deepEqual(parse(token.coins(25, true)), [{ type: "coins", n: 25, signed: true }])
  assert.deepEqual(parse(token.coins(-25, true)), [{ type: "coins", n: -25, signed: true }])
  assert.deepEqual(parse(token.rate(3)), [{ type: "rate", n: 3, signed: false }])
  assert.deepEqual(parse(token.amount("planks", 2)), [{ type: "amount", good: "planks", n: 2 }])
  assert.deepEqual(parse(token.kind("fishery")), [{ type: "kind", kind: "fishery", shown: null }])
  assert.deepEqual(parse(token.kind("fishery", "fisheries")), [{ type: "kind", kind: "fishery", shown: "fisheries" }])
  assert.deepEqual(parse(token.good("bread", "loaves")), [{ type: "good", good: "bread", shown: "loaves" }])
  assert.deepEqual(parse(token.command("homes")), [{ type: "command", command: "homes" }])
  assert.deepEqual(parse(token.view("fire")), [{ type: "view", view: "fire" }])
  assert.deepEqual(parse(token.key("S")), [{ type: "key", key: "S" }])
})

test("a message is its words and its tokens in order, and what is not a token stays words", () => {
  assert.deepEqual(parse(`Lay ${token.command("homes")} for ${token.coins(15)}, then open [nothing] and [kind:castle].`), [
    { type: "text", text: "Lay " },
    { type: "command", command: "homes" },
    { type: "text", text: " for " },
    { type: "coins", n: 15, signed: false },
    { type: "text", text: ", then open [nothing] and [kind:castle]." }
  ])
})

test("every tool, map view, building, and good can be named in a message, in every language", () => {
  for (const t of catalogs) {
    for (const id of Object.keys(commands) as Array<CommandId>) assert.equal(plain(t, token.command(id)), t.commands[id].label)
    for (const id of Object.keys(mapViews) as Array<MapViewId>) assert.equal(plain(t, token.view(id)), t.mapViews[id].chip)
    for (const id of kindIds) assert.equal(plain(t, token.kind(id)), t.kind.name(id))
    for (const id of goodIds) assert.equal(plain(t, token.good(id)), t.good.name(id))
  }
})

test("an amount reads in plain words where an icon cannot go", () => {
  assert.equal(plain(en, `${token.coins(25)} · ${token.amount("planks", 1)} · ${token.amount("planks", 3)} · ${token.amount("stone", 2)}`), "25 coins · 1 plank · 3 planks · 2 stone")
  assert.equal(plain(en, token.coins(1)), "1 coin")
  assert.equal(plain(en, token.coins(-25, true)), "−25 coins")
  assert.equal(plain(en, token.coins(40, true)), "+40 coins")
  assert.equal(plain(en, token.rate(3)), "3 coins a minute")
  assert.equal(en.cost({ coins: 60, materials: { planks: 3 } }), `${token.coins(60)} · ${token.amount("planks", 3)}`)
})

// ── Names ─────────────────────────────────────────────────────────────────

test("every language names every building at every level of its upgrades, and every rank", () => {
  for (const t of catalogs) {
    for (const id of kindIds) {
      const seen = new Set<string>()
      for (let level = 0; level <= 2 && (level === 0 || upgradeAt(kinds[id], level)); level++) {
        const name = t.kind.name(id, level)
        assert.ok(name !== "" && t.kind.title(id, level) !== "" && t.kind.blurb(id, level) !== "", `${t.locale}: ${id} at level ${level} has a name and a blurb`)
        assert.ok(!seen.has(name), `${t.locale}: ${id} at level ${level} has a name of its own, not "${name}" again`)
        seen.add(name)
      }
    }
    assert.equal(new Set(ranks.map((_, rank) => t.rank(rank))).size, ranks.length, `${t.locale}: each rank has a name of its own`)
  }
})

test("a street is named after its landmark, each way it can be, in every language", () => {
  for (const t of catalogs) {
    assert.ok(t.place(null) !== "")
    for (const kind of kindIds) {
      const names = new Set(Array.from({ length: STREET_WAYS }, (_, way) => t.place({ kind, way })))
      assert.equal(names.size, kind === "townhall" ? 1 : STREET_WAYS, `${t.locale}: the streets by a ${kind} have ${[...names].join(", ")}`)
    }
  }
})

// ── What the simulation says ──────────────────────────────────────────────

const mill: Place = { kind: "mill", way: 0 }
/** One of everything the chronicle can hold: a tag missing here does not compile. */
const events: { readonly [T in Event["_tag"]]: ReadonlyArray<Extract<Event, { readonly _tag: T }>> } = {
  founded: [{ _tag: "founded", size: "medium", land: "fair", term: 60 }],
  nextTerm: [{ _tag: "nextTerm", term: 2, minutes: 60 }],
  residents: [{ _tag: "residents", mark: 100 }],
  treasuryEmpty: [{ _tag: "treasuryEmpty" }],
  uproar: [{ _tag: "uproar" }],
  bankrupt: [{ _tag: "bankrupt" }],
  revolt: [{ _tag: "revolt" }],
  abandoned: [{ _tag: "abandoned" }],
  dismissed: [{ _tag: "dismissed", patience: 3 }],
  termOver: [{ _tag: "termOver", term: 1, rank: 2 }],
  goalsMet: [{ _tag: "goalsMet", rank: 1 }],
  rankReached: [{ _tag: "rankReached", rank: 3, reward: 1500 }],
  crownAsks: [{ _tag: "crownAsks", amount: 20, good: "planks", minutes: 4.5, reward: 120 }],
  crownUnanswered: [{ _tag: "crownUnanswered", amount: 20, good: "smoked", fine: 60 }],
  crownSent: [{ _tag: "crownSent", amount: 1, good: "tools", reward: 40 }],
  winter: [{ _tag: "winter", severity: "hard", year: 2, fishing: 40, heating: true }, { _tag: "winter", severity: "mild", year: 1, fishing: 75, heating: false }],
  spring: [{ _tag: "spring", year: 3 }],
  winterComing: [{ _tag: "winterComing", severity: "normal", larder: 42, eats: 12 }],
  fire: [{ _tag: "fire", place: mill }, { _tag: "fire", place: null }],
  fireOver: [{ _tag: "fireOver", place: mill, homes: 0, buildings: 0 }, { _tag: "fireOver", place: mill, homes: 1, buildings: 0 }, { _tag: "fireOver", place: { kind: "townhall", way: 3 }, homes: 12, buildings: 2 }],
  sickness: [{ _tag: "sickness", place: mill }],
  theftCoins: [{ _tag: "theftCoins", place: mill, coins: 35 }],
  theftGoods: [{ _tag: "theftGoods", place: mill, good: "cloth" }],
  derelict: [{ _tag: "derelict", place: mill }],
  collapsed: [{ _tag: "collapsed", kind: "bakery", place: mill }, { _tag: "collapsed", kind: null, place: mill }],
  rotted: [{ _tag: "rotted", rotted: 1, made: null, eaten: 3 }, { _tag: "rotted", rotted: 14, made: 30, eaten: 12 }],
  lastRock: [{ _tag: "lastRock", ore: true }, { _tag: "lastRock", ore: false }],
  worksBegin: [{ _tag: "worksBegin", kind: "market", level: 1 }, { _tag: "worksBegin", kind: "townhall", level: 2 }],
  upgraded: [{ _tag: "upgraded", kind: "market", level: 1 }, { _tag: "upgraded", kind: "townhall", level: 2 }],
  legacy: [{ _tag: "legacy", text: "Founded on medium, fair land, for a term of 60 minutes." }]
}

const locks: ReadonlyArray<Lock> = [{ _tag: "residents", needs: 20, has: 12 }, { _tag: "citizens", needs: 10, has: 0 }]
const salvage = { fee: 25, back: { planks: 2, stone: 3 } satisfies Partial<Record<GoodId, number>> }
/** One of everything an edit can answer with. */
const notices: { readonly [T in Notice["_tag"]]: ReadonlyArray<Extract<Notice, { readonly _tag: T }>> } = {
  locked: locks.map((lock) => ({ _tag: "locked", kind: "smokehouse", lock })),
  pieceLocked: [{ _tag: "pieceLocked", prop: "statue" }],
  noRoom: [{ _tag: "noRoom" }],
  short: [{ _tag: "short", of: "coins" }, ...goodIds.map((of) => ({ _tag: "short" as const, of }))],
  parkFirst: [{ _tag: "parkFirst" }],
  rockUnworked: [{ _tag: "rockUnworked" }],
  hallStays: [{ _tag: "hallStays" }],
  salvageFee: [{ _tag: "salvageFee", fee: 25 }],
  pulledDown: [
    { _tag: "pulledDown", cancelled: false, salvage, lost: 0 },
    { _tag: "pulledDown", cancelled: true, salvage: { fee: -60, back: { planks: 1 } }, lost: 2 }
  ],
  crownSent: [{ _tag: "crownSent", reward: 120 }],
  upgradeBlocked: [{ _tag: "upgradeBlocked", kind: "market", level: 1, rank: 2 }],
  worksBegun: [{ _tag: "worksBegun", kind: "townhall", level: 2, coins: 900, materials: { planks: 10, stone: 20 } }]
}

test("everything the chronicle can hold is put into words, in every language", () => {
  const all: ReadonlyArray<Event> = Object.values(events).flat()
  for (const t of catalogs) for (const event of all) wellFormed(t, say(t.chronicle, event), `news ${event._tag}`)
})

test("everything an edit can answer with is put into words, in every language", () => {
  for (const t of catalogs) {
    const all: ReadonlyArray<Notice> = Object.values(notices).flat()
    for (const notice of all) wellFormed(t, say(t.notice, notice), `notice ${notice._tag}`)
    for (const lock of locks) wellFormed(t, say(t.lock, lock), `lock ${lock._tag}`)
    for (let rank = 0; rank < ranks.length; rank++) wellFormed(t, t.needsRank(rank), `rank ${rank}`)
  }
})

test("the chronicle reads in English as it always has", () => {
  const told = (event: Event) => plain(en, say(en.chronicle, event))
  assert.equal(told({ _tag: "founded", size: "medium", land: "fair", term: 60 }), "Founded on medium, fair land, for a term of 60 minutes.")
  assert.equal(told({ _tag: "fire", place: mill }), "Fire on Mill Lane!")
  assert.equal(told({ _tag: "fireOver", place: { kind: "townhall", way: 4 }, homes: 2, buildings: 1 }), "Fire on Hall Square: two homes and one building lost.")
  assert.equal(told({ _tag: "fireOver", place: null, homes: 0, buildings: 0 }), "Fire on the edge of town: put out.")
  assert.equal(told({ _tag: "winter", severity: "hard", year: 2, fishing: 40, heating: true }), "A hard winter, year 2: the fields lie still and fisheries catch 40%; homes burn fires to keep warm.")
  assert.equal(told({ _tag: "rankReached", rank: 1, reward: 300 }), "The town is now a village: the crown sends 300 coins.")
  assert.equal(told({ _tag: "upgraded", kind: "townhall", level: 2 }), "The guildhall is now a city hall.")
  assert.equal(told({ _tag: "worksBegin", kind: "farm", level: 1 }), "Works begin on the farm: it is to be an estate.")
  assert.equal(told({ _tag: "rotted", rotted: 1, made: null, eaten: 3 }), "One fish or loaf rotted in store this minute: a granary keeps fish and bread five times as long, and smoked fish keeps.")
  assert.equal(told({ _tag: "collapsed", kind: null, place: mill }), "A home on Mill Lane fell down: nobody mended it.")
})

test("an edit's answer reads in English as it always has", () => {
  const told = (notice: Notice) => plain(en, say(en.notice, notice))
  assert.equal(told({ _tag: "locked", kind: "smokehouse", lock: { _tag: "residents", needs: 20, has: 12 } }), "Smokehouse needs 20 residents (the town has 12)")
  assert.equal(told({ _tag: "short", of: "planks" }), "Not enough planks")
  assert.equal(told({ _tag: "pulledDown", cancelled: false, salvage, lost: 0 }), "Pulled down · −25 coins · 2 planks, 3 stone back")
  assert.equal(told({ _tag: "upgradeBlocked", kind: "market", level: 1, rank: 2 }), "Market hall needs the town to be a town")
})

test("a building named in the news is one the page can make a chip of", () => {
  const kindsNamed = (message: string): ReadonlyArray<KindId> => parse(message).flatMap((part) => (part.type === "kind" ? [part.kind] : []))
  const fell: Event = { _tag: "collapsed", kind: "bakery", place: mill }, risen: Event = { _tag: "upgraded", kind: "market", level: 1 }
  for (const t of catalogs) {
    assert.deepEqual(kindsNamed(say(t.chronicle, fell)), ["bakery"], t.locale)
    assert.deepEqual(kindsNamed(say(t.chronicle, risen)), ["market"], t.locale)
  }
})

// ── The catalog as a whole ────────────────────────────────────────────────

/** Every string a catalog holds outright (not made by a function), with the path to it. */
const strings = (value: unknown, path: string): ReadonlyArray<readonly [string, string]> => {
  if (typeof value === "string") return [[path, value]]
  if (typeof value !== "object" || value === null) return []
  return Object.entries(value).flatMap(([key, inner]) => strings(inner, `${path}.${key}`))
}

test("no language leaves a message empty or holds a token the game does not know", () => {
  for (const t of catalogs) for (const [path, message] of strings(t, "t")) wellFormed(t, message, path)
})

test("every language says the same things as English: the same messages, no more and no fewer", () => {
  const shape = (value: unknown, path: string): ReadonlyArray<string> =>
    typeof value === "object" && value !== null ? Object.entries(value).flatMap(([key, inner]) => shape(inner, `${path}.${key}`)) : [`${path}: ${typeof value}`]
  const english = shape(en, "t")
  for (const t of catalogs) assert.deepEqual(shape(t, "t"), english, t.locale)
})

// ── Which language ────────────────────────────────────────────────────────

test("the language is the one chosen before, else the reader's own, else English", () => {
  assert.equal(pick(null, []), "en")
  assert.equal(pick("en", ["xx"]), "en")
  assert.equal(pick(null, ["xx-YY", "en-GB"]), "en")
  assert.equal(pick("not-a-language", ["zz"]), "en")
  for (const locale of locales) {
    assert.equal(pick(locale, []), locale, "the saved choice wins")
    assert.equal(pick(null, [locale.toUpperCase()]), locale, "a browser's tag is matched whatever its case")
    assert.equal(pick(null, [`${locale}-XX`]), locale, "a regional tag falls back to its language")
  }
})

test("each language is loaded as the catalog it says it is", async () => {
  for (const locale of locales) {
    const t = await load(locale)
    assert.equal(t.locale, locale)
    assert.equal(localeOf(t), locale)
    assert.ok(languageName(locale) !== "")
    assert.doesNotThrow(() => new Intl.PluralRules(t.locale))
  }
})

// ── Keeping the choice ────────────────────────────────────────────────────

/** A browser's storage, in a map; `blocked`: one that throws on every use, as a browser set to keep nothing does. */
const storage = (blocked = false) => {
  const kept = new Map<string, string>()
  const guard = () => {
    if (blocked) throw new Error("storage is blocked")
  }
  return {
    getItem: (key: string) => (guard(), kept.get(key) ?? null),
    setItem: (key: string, value: string) => (guard(), void kept.set(key, value)),
    removeItem: (key: string) => (guard(), void kept.delete(key))
  }
}

test("the language chosen is kept for the next visit, and a browser that keeps nothing only forgets it", () => {
  const store = storage()
  assert.equal(preferred(store), null, "none chosen yet")
  for (const locale of locales) {
    assert.equal(prefer(store, locale), true)
    assert.equal(pick(preferred(store), ["zz"]), locale)
  }
  const blocked = storage(true)
  assert.equal(prefer(blocked, "en"), false, "the page is told the choice was not kept")
  assert.equal(preferred(blocked), null)
})

test("a change of language carries the town over the reload once, with where the mayor was looking", () => {
  const tab = storage()
  assert.equal(carriedOver(tab), null, "an ordinary visit carries nothing over")
  assert.equal(carryOver(tab, '{"x":24,"y":27}'), true)
  assert.equal(carriedOver(tab), '{"x":24,"y":27}')
  assert.equal(carriedOver(tab), null, "taken once: the next reload asks for a charter as usual")
  assert.equal(carryOver(storage(true), "{}"), false, "a tab that keeps nothing says so, and the page does not reload")
  assert.equal(carriedOver(storage(true)), null)
})

test("a stored name outside the locale catalog falls back to the browser's language", async () => {
  for (const invalid of ["constructor", "__proto__", "toString", "no-such-language"]) {
    const locale = pick(invalid, ["de-DE", "en"])
    assert.equal(locale, "de")
    assert.equal(localeOf(await load(locale)), "de")
  }
})
