import { carrierDress, cartLook, residentDress, serviceDress, homeVariant, type CartLook, type Load, type PersonDress } from "../art.ts"
import { goods, type GoodId } from "../content.ts"
import { Drawing, palette, type Vertex } from "./primitives.ts"
import { U } from "../iso.ts"
import { chair, chest } from "./furniture.ts"

const R = 45.2548
export type ServiceRole = "watchman" | "firefighter" | "physician" | "constable" | "builder"
export function serviceCostume(dress: PersonDress, role: ServiceRole): PersonDress {
  const coats = { watchman: 0xb56e58, firefighter: 0xb96750, physician: 0xdce7d4, constable: 0x6e88a2, builder: 0xb69b72 }
  return { ...dress, coat: coats[role], trim: role === "firefighter" ? 0xc3aa72 : role === "physician" ? 0xeef2e4 : coats[role], hat: role === "physician" ? "bonnet" : role === "firefighter" ? "brim" : "cap", long: role === "physician" }
}
export function drawPerson(d: Drawing, dress: PersonDress, load: Load, cart: CartLook | null, phase = 0) {
  const swing = phase === 0 ? 1 : -1
  // Complete rounded volumes preserve the simple original silhouette.
  d.line(
    [
      [-1 / 64, 1 / 64, 5],
      [swing * 0.03, 0, 0]
    ],
    1
  )
  d.line(
    [
      [1 / 64, -1 / 64, 5],
      [-swing * 0.03, 0, 0]
    ],
    1
  )
  if (dress.long) {
    const start = d.asset.faces.length,
      ring = (z: number, r: number) =>
        Array.from({ length: 24 }, (_, i): Vertex => [
          (Math.cos((i / 24) * Math.PI * 2) * r) / R,
          (Math.sin((i / 24) * Math.PI * 2) * r) / R,
          z
        ]),
      bottom = ring(3, 3.2),
      top = ring(10.5, 2.6)
    for (let i = 0; i < 24; i++) d.face([bottom[i]!, bottom[(i + 1) % 24]!, top[(i + 1) % 24]!, top[i]!], dress.coat, 0)
    d.face(top, dress.coat, 0)
    d.face([...bottom].reverse(), dress.coat, 0)
    d.volume(start, 1)
  } else d.ellipsoid(0, 0, 7.5, 2.5 / R, 2.5 / R, 3.27, dress.coat, 1)
  d.ellipsoid(0, 0, 13.5, 2.2 / R, 2.2 / R, 1.905, dress.skin, 1)
  if (cart) {
    for (const v of [-0.038, 0.038])
      d.line(
        [
          [0, v, 9.5],
          [0.11, v, 7]
        ],
        1
      )
  } else {
    d.line(
      [
        [-0.028, 0.038, 9.5],
        [swing * 0.02 - 0.028, 0.06, 6]
      ],
      1
    )
    d.line(
      [
        [0.028, -0.038, 9.5],
        [-swing * 0.02 + 0.028, -0.06, 6]
      ],
      1
    )
  }
  const hat = dress.trim === 0xf7f8f4 ? dress.coat : dress.trim
  switch (dress.hat) {
    case "cap":
      d.ellipsoid(0, 0, 15.4, 2.4 / R, 2.4 / R, 1.65, hat, 0.75)
      d.face(
        [
          [0.015, -0.05, 15],
          [0.09, -0.05, 14.7],
          [0.09, 0.05, 14.7],
          [0.015, 0.05, 15]
        ],
        hat,
        0.75
      )
      break
    case "brim":
      d.cylinder(0, 0, 3.6 / R, 14.9, 0.25, dress.trim, dress.trim, 0.75)
      d.cylinder(0, 0, 1.8 / R, 15.1, 3, dress.trim, dress.trim, 0.75)
      break
    case "top":
      d.cylinder(0, 0, 3 / R, 14.9, 0.25, palette.ink, palette.ink, 0.75)
      d.cylinder(0, 0, 1.7 / R, 15.1, 4.3, palette.ink, palette.ink, 0.75)
      d.cylinder(0, 0, 1.74 / R, 16, 0.8, dress.coat, dress.coat, 0)
      break
    case "bonnet":
      d.ellipsoid(-0.028, 0, 14.7, 2.7 / R, 2.8 / R, 2.4, dress.trim, 0.75)
      d.ellipsoid(0.035, 0, 13.7, 1.5 / R, 1.5 / R, 1.3, dress.skin, 0.6)
      break
    case "hood":
      d.ellipsoid(-0.028, 0, 14.2, 2.9 / R, 2.9 / R, 3.5, dress.coat, 0.75)
      d.ellipsoid(0.038, 0, 13.7, 1.5 / R, 1.5 / R, 1.3, dress.skin, 0.6)
      break
  }
  if (load.kind === "basket") {
    const u = -0.07,
      v = 0.07
    d.cylinder(u, v, 2.2 / R, 5, 3.5, 0xe3c592, 0xc9a46a, 1)
    const handle = Array.from({ length: 12 }, (_, i): Vertex => [
      u + (Math.cos((i / 11) * Math.PI) * 1.8) / 64,
      v - (Math.cos((i / 11) * Math.PI) * 1.8) / 64,
      8.5 + Math.sin((i / 11) * Math.PI) * 2
    ])
    d.line(handle, 0.75)
    load.goods.slice(0, 3).forEach((good, i) => d.ellipsoid(u + (i - 1) * 0.02, v, 9, 0.02, 0.02, 0.65, goods[good].color, 0))
  } else if (load.kind === "bell") {
    const u = 0.075,
      v = -0.015
    d.line(
      [
        [0.04, -0.025, 9],
        [u, v, 7.5]
      ],
      1
    )
    d.cylinder(u, v, 1.3 / R, 5, 0.25, 0xe3c25a, 0xe3c25a, 0.75)
    d.ellipsoid(u, v, 6, 1 / R, 1 / R, 1.2, 0xe3c25a, 0.75)
    d.line(
      [
        [u, v, 7],
        [u, v, 8]
      ],
      0.75,
      0x8a6a45
    )
  }
  if (load.kind === "service") {
    const u = 0.08, v = -0.05
    if (load.role === "physician") {
      d.box(u, v, 1.3 * U, U, 4, 3.5, 0xa9bfad, 0xc9dac7, 0x92ad98, 0.75)
      d.line([[u - U, v, 8], [u - U, v, 9], [u + U, v, 9], [u + U, v, 8]], 0.75)
      d.line([[u, v + 1.01 * U, 4.8], [u, v + 1.01 * U, 6.8]], 1, 0xf4f5eb)
      d.line([[u - 0.6 * U, v + 1.01 * U, 5.8], [u + 0.6 * U, v + 1.01 * U, 5.8]], 1, 0xf4f5eb)
    } else if (load.role === "firefighter") {
      d.cylinder(u, v, 1.5 * U, 2, 4, 0xb8a27d, 0xb4cfdb, 0.75, 12)
      d.line([[u - U, v, 6], [u, v, 9], [u + U, v, 6]], 0.75)
      d.line([[-0.08, 0.02, 5], [-0.08, 0.02, 13]], 1.5, 0x8a6a45)
      d.box(-0.08, 0.02, 1.3 * U, 0.6 * U, 12, 2, 0xbfc7bd, 0xd7dfd1, 0x9da89c, 0.75)
    } else if (load.role === "watchman") {
      d.line([[u, v, 6], [u, v, 18]], 1, 0x8a6a45)
      d.box(u, v, U, U, 8, 3, 0xe5d6a5, 0xf3e6bd, 0xd6c48d, 0.75)
      d.cylinder(u, v, 1.4 * U, 11, 0.5, palette.ink, palette.ink, 0.75, 12)
    } else if (load.role === "constable") {
      d.line([[u, v, 4], [u, v, 11]], 1.5, 0x8a6a45)
      d.face([[-0.05, 0.058, 8], [-0.01, 0.058, 8], [-0.01, 0.058, 6], [-0.03, 0.058, 5], [-0.05, 0.058, 6]], 0xd5c697, 0.75)
    } else {
      d.box(u, v, 1.7 * U, U, 3, 3, 0xd5b28a, 0xe9d2a8, 0xbda07a, 0.75)
      d.line([[u - U, v, 6], [u - U, v, 8], [u + U, v, 8], [u + U, v, 6]], 0.75)
      d.line([[-0.07, 0, 6], [-0.07, 0, 12]], 1.5, 0x8a6a45)
      d.box(-0.07, 0, U, 0.7 * U, 11, 2, 0xb8bfae, 0xd5dbc9, 0x9ea993, 0.75)
    }
  }
}

export function drawCargo(d: Drawing, good: GoodId, count: number, u: number, v: number, z: number) {
  const n = count >= 4 ? 3 : count >= 2 ? 2 : 1
  switch (good) {
    case "wood":
      for (const [level, row] of [[-0.9, 0, 0.9], [-0.45, 0.45], [0]].slice(0, n).entries())
        for (const c of row) d.log("u", v + c * U, u - 2.2 * U, u + 2.2 * U, z + level * 2, 1.15, 0xb08a5e, 0xe9d2a8)
      break
    case "wheat":
    case "cloth":
    case "wool": {
      const side = good === "wheat" ? 0xe9cf7c : good === "cloth" ? 0x8a58a8 : 0xf4f4ef,
        end = good === "wheat" ? 0xf3e3a8 : good === "cloth" ? 0xc7aed6 : 0xffffff
      for (const [level, row] of [[-0.75, 0.75], [0]].slice(0, Math.min(2, n)).entries())
        for (const c of row) d.log("u", v + c * U, u - 2 * U, u + 2 * U, z + level * 2.6, good === "wool" ? 1.9 : 1.5, side, end)
      if (n === 3 && good !== "wool") d.log("u", v, u - 1.4 * U, u + 1.4 * U, z + 5, 1.3, side, end)
      break
    }
    case "planks":
      for (let i = 0; i < n + 1; i++) d.box(u, v, 2.4 * U, 1.1 * U, z + i * 1.5, 1.5, 0xf0c59a, 0xe2a873, 0xd2945c, 1)
      break
    case "stone":
    case "ore": {
      const colors = good === "stone" ? [0xeeefe9, 0xdfe1da, 0xcbcfc7] : [0xe8ebf0, 0xd5dae3, 0xbcc3d0]
      for (const [a, c, dz] of [
        [-1, -0.5, 0],
        [1, 0.5, 0],
        [0, 0, 3]
      ].slice(0, n))
        d.box(u + a! * U, v + c! * U, 0.8 * U, 0.8 * U, z + dz!, 3, colors[0]!, colors[1]!, colors[2]!, 1)
      if (good === "ore") d.ellipsoid(u, v, z + (n === 3 ? 6 : 3), 0.022, 0.025, 0.8, 0x4a5368, 0)
      break
    }
    case "fish":
    case "bread": {
      const fishy = good !== "bread",
        tint = good === "fish" ? 0x2f8c87 : 0xd98a6a
      d.box(u, v, 1.6 * U, 1.1 * U, z, 3, 0xc9a46a, 0xe3c592, 0xd2b07a, 1)
      for (let i = 0; i < n + 1; i++) {
        const x = u + (i - n / 2) * 0.9 * U,
          y = v + (i % 2 === 0 ? -0.3 : 0.3) * U
        d.ellipsoid(x, y, z + 3.6, fishy ? 0.049 : 0.04, 0.028, 0.75, tint, 0.75)
        if (fishy)
          d.face(
            [
              [x - 0.055, y - 0.03, z + 3.6],
              [x - 0.055, y + 0.03, z + 3.6],
              [x - 0.02, y, z + 3.6]
            ],
            tint,
            0.75
          )
      }
      break
    }
    case "smoked": {
      d.box(u, v, 2.2 * U, 1.3 * U, z, 2, 0xd5b28a, 0xe9d2a8, 0xbda07a, 1)
      for (let i = 0; i < n + 1; i++) {
        const y = v + (i - n / 2) * 0.8 * U
        // Split cured fillets, tied in pairs: flatter and longer than fresh fish.
        d.ellipsoid(u, y, z + 2.8, 2 * U, 0.4 * U, 0.6, 0xb98a61, 0.75, 0xd9b589, 12)
        for (const x of [-1, 0, 1]) d.line([[u + x * U, y - 0.3 * U, z + 3.2], [u + (x + 0.3) * U, y + 0.3 * U, z + 3.2]], 0.5, 0x8a6a45)
      }
      for (const x of [-0.8, 0.8]) d.line([[u + x * U, v - U, z + 3.6], [u + x * U, v + U, z + 3.6]], 0.75, 0xe6d4b2)
      break
    }
    case "flour":
      ;[-1, 1, 0].slice(0, n).forEach((a, i) => d.sack(u + a * U, v, z + (i === 2 ? 4 : 0)))
      break
    case "tools":
      d.crate(u, v, z, goods[good].color, 1.6 * U, 4)
      d.line(
        [
          [u, v, z + 4],
          [u + 0.04, v, z + 9]
        ],
        1.5,
        0x8a6a45
      )
      d.box(u + 0.03, v, 0.035, 0.018, z + 8, 1.6, 0x8f9891, 0x8f9891, 0x7c857d, 0.75)
      break
    case "furniture": {
      chest(d, u, v, z)
      if (n >= 2) chair(d, u, v, z + 4.65)
      break
    }
  }
}

export function drawCart(d: Drawing, look: CartLook, load: Load) {
  const u = 5.5 * U,
    v = 0,
    L = 2.4 * U,
    W = 1.6 * U,
    bed = 5,
    r = 2.6
  const wheel = (x: number, y: number) => {
    const n = 20,
      p = (angle: number, out = 0): Vertex => [x + ((Math.cos(angle) * r) / Math.sqrt(5)) * U, y + out, r + Math.sin(angle) * r]
    const ring = Array.from({ length: n }, (_, i) => p((i / n) * Math.PI * 2)),
      back = ring.map(([u, v, z]): Vertex => [u, v + 0.013, z])
    for (let i = 0; i < n; i++) d.face([ring[i]!, ring[(i + 1) % n]!, back[(i + 1) % n]!, back[i]!], palette.ink, 0)
    d.face(ring, look.spokes ? 0xf2efe6 : look.wood.right, 1)
    d.face(back, look.spokes ? 0xf2efe6 : look.wood.right, 1)
    if (look.spokes) for (const t of [0, Math.PI / 2]) d.line([p(t, -0.002), p(t + Math.PI, -0.002)], 0.75)
    d.ellipsoid(x, y - 0.006, r, 0.015, 0.015, 0.6, palette.ink, 0)
  }
  if (look.wheels === 2) {
    wheel(u, v - W - 0.4 * U)
    wheel(u, v + W + 0.4 * U)
  } else {
    wheel(u + L + 0.5 * U, v)
    for (const c of [-W * 0.6, W * 0.6])
      d.line(
        [
          [u - L + U, v + c, 0],
          [u - L + U, v + c, bed - 1]
        ],
        1
      )
  }
  d.box(u, v, L, W, bed - 2, 2.5, look.wood.top, look.wood.left, look.wood.right, 1)
  for (const side of [-1, 1])
    d.line(
      [
        [0.06, side * 0.035, 7],
        [u - L, v + side * W * 0.7, 4]
      ],
      1
    )
  if (load.kind === "cart" && load.count > 0) drawCargo(d, load.good, load.count, u, v, bed + 0.5)
}

export function makePerson(
  id: string,
  title: string,
  dress: PersonDress,
  load: Load = { kind: "none" },
  cart: CartLook | null = null,
  phase = 0
) {
  const d = new Drawing(id, title, "Full 3D figure with the original coat, skin, hat and accessories. No flat character sprites.")
  d.asset.category = cart ? "cargo" : "people"
  d.asset.reference = { type: "walker", dress, load, cart, phase }
  d.asset.footprint = 1
  drawPerson(d, dress, load, cart, phase)
  if (cart) drawCart(d, cart, load)
  return d.asset
}

export function personCatalogue() {
  const items = []
  for (const [i, hat] of ["cap", "brim", "none"].entries())
    items.push(makePerson(`worker-${hat}`, `Carrier · ${hat}`, { ...carrierDress(0.2 + i * 0.2), hat: hat as PersonDress["hat"] }))
  for (const [i, hat] of ["bonnet", "cap", "none"].entries())
    items.push(
      makePerson(`settler-${hat}`, `Settler · ${hat}`, {
        ...residentDress(homeVariant(i / 4 + 0.03).cloth, 1, 0.2 + i * 0.3),
        hat: hat as PersonDress["hat"]
      })
    )
  items.push(makePerson("settler-long", "Settler · long coat", residentDress(0xb5654a, 1, 0.95)))
  for (const [i, hat] of ["top", "brim"].entries())
    items.push(
      makePerson(`citizen-${hat}`, `Citizen · ${hat} hat`, {
        ...residentDress(homeVariant(i / 4 + 0.03).cloth, 2, 0.2 + i * 0.5),
        hat: hat as PersonDress["hat"]
      })
    )
  items.push(
    makePerson("market-walker", "Market walker", serviceDress(0x3d6db5, 0.3, false), { kind: "basket", goods: ["fish", "bread", "cloth"] })
  )
  items.push(makePerson("chapel-walker", "Chapel walker", serviceDress(0x3d6db5, 0.6, true), { kind: "bell" }))
  for (const role of ["watchman", "firefighter", "physician", "constable", "builder"] as const)
    items.push(makePerson(`service-${role}`, role[0]!.toUpperCase() + role.slice(1), serviceCostume(serviceDress(0x3d6db5, 0.3, false), role), { kind: "service", role }))
  for (let i = 0; i < 16; i++) {
    const tier = i < 8 ? 1 : 2,
      n = (i * 0.37) % 1,
      roof = homeVariant((i % 8) / 8 + 0.03)
    items.push(
      makePerson(
        `resident-${tier}-${i % 8}`,
        `${tier === 1 ? "Settler" : "Citizen"} · household ${(i % 8) + 1}`,
        residentDress(roof.cloth, tier, n),
        { kind: "none" },
        null,
        i % 2
      )
    )
  }
  return items
}
export function makeCarrier(good: GoodId | null, barrow = false, count = 4) {
  const id = `${barrow ? "barrow" : "cart"}-${good ?? "empty"}${good ? `-${count}` : ""}`,
    look = cartLook(barrow ? 0.12 : 0.45)
  const load: Load = good ? { kind: "cart", good, count } : { kind: "none" }
  return makePerson(
    id,
    `${barrow ? "Barrow" : "Handcart"} · ${good ? `${goods[good].title}, ${count === 1 ? "small" : "full"} load` : "empty"}`,
    carrierDress(barrow ? 0.2 : 0.4),
    load,
    look
  )
}
export function makeGoods(good: GoodId) {
  const d = new Drawing(`goods-${good}`, goods[good].title, "Distinct cargo geometry, not a colour-swapped box.")
  d.asset.category = "cargo"
  d.asset.reference = { type: "cargo", good, count: 4 }
  d.asset.footprint = 1
  drawCargo(d, good, 4, 0, 0, 0)
  return d.asset
}
export function makeCrate(good: GoodId) {
  const d = new Drawing(`crate-${good}`, `${goods[good].title} crate`, "Cardboard crate with its original coloured label and strap.")
  d.asset.category = "cargo"
  d.asset.reference = { type: "crate", good }
  d.asset.footprint = 1
  d.crate(0, 0, 0, goods[good].color, 1.8 * U, 6)
  return d.asset
}
