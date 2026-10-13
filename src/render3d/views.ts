import * as THREE from "three"
import {
  carrierDress,
  cartLook,
  serviceDress,
  type BuildingLook,
  type HouseLook,
  type PersonDress,
  type CartLook,
  type Load,
  type Emphasis
} from "../art.ts"
import { kinds, GROWN, ROCK_AMOUNT, type KindId } from "../content.ts"
import { U, type Point } from "../iso.ts"
import { vertex3 } from "../asset-lab/renderer.ts"
import { Drawing, type Vertex } from "../asset-lab/primitives.ts"
import { makeSails, makeFlag } from "../asset-lab/buildings.ts"
import { makeMarker } from "../asset-lab/construction.ts"
import { makePerson } from "../asset-lab/people.ts"
import { makeTree, makeRock, makeField, hash } from "../asset-lab/land.ts"
import { ModelHandle } from "./pool.ts"
import { buildingAsset, homeAsset, homeKey, doorKey, noDoors, quantizeBuild, plateAsset, treeVariant } from "./models.ts"
import type { GameScene, SceneNode } from "./scene.ts"

export class WorldView implements SceneNode {
  readonly group = new THREE.Group()
  readonly anchor = { x: 0, y: 0 }
  readonly stage: GameScene
  readonly entity: number
  protected models: Array<ModelHandle> = []
  private disposed = false
  private opacity = 1
  constructor(stage: GameScene, entity: number) {
    this.stage = stage
    this.entity = entity
  }
  protected model(pickable = true) {
    const model = new ModelHandle(this.stage.pool, pickable ? this.entity : null, this.anchor)
    this.models.push(model)
    this.group.add(model.root)
    return model
  }
  get alpha() {
    return this.opacity
  }
  set alpha(value: number) {
    this.opacity = value
    for (const m of this.models) m.alpha = value
  }
  orient() {}
  protected emphasis(emphasis: Emphasis) {
    for (const m of this.models) m.tint.setHex(emphasis === "danger" ? 0xf3b5aa : 0xffffff)
  }
  destroy() {
    if (this.disposed) return
    this.disposed = true
    for (const m of this.models) m.dispose()
    this.group.removeFromParent()
    this.stage.remove(this)
  }
}

export class BuildingView extends WorldView {
  private kindId: KindId
  private body: ModelHandle
  private plate: ModelHandle
  private marker: ModelHandle
  private motion: ModelHandle
  private smokes: Array<ModelHandle>
  private rings: Array<number> = []
  private puff = 0
  private wave = 0
  private opening = 0
  private beat = -1
  private pulse = 0
  constructor(kindId: KindId, stage: GameScene, entity: number) {
    super(stage, entity)
    this.kindId = kindId
    this.body = this.model()
    this.plate = this.model()
    this.marker = this.model()
    this.motion = this.model()
    this.marker.use("problem-marker", makeMarker)
    this.marker.root.visible = false
    this.body.root.add(this.motion.root)
    this.smokes = [this.model(false), this.model(false), this.model(false)]
    for (const s of this.smokes) s.root.visible = false
  }
  place(x: number, y: number) {
    const size = kinds[this.kindId].size
    this.anchor.x = x + size / 2
    this.anchor.y = y + size / 2
    this.group.position.copy(vertex3([this.anchor.x, this.anchor.y, 0]))
  }
  update(look: BuildingLook, dt: number, emphasis: Emphasis) {
    const kind = kinds[this.kindId],
      build = quantizeBuild(look.build),
      doors = { ...noDoors, ...look.doors },
      share = look.site === null ? null : Math.round(look.site * 3) / 3
    if (this.beat >= 0 && look.beat > this.beat) this.pulse = 1
    this.beat = look.beat
    this.pulse = Math.max(0, this.pulse - dt * 3)
    this.opening += (Number(look.working || this.pulse > 0.2) - this.opening) * Math.min(1, dt * 6)
    const open = Math.round(this.opening * 4) / 4
    this.body.use(`building/${this.kindId}/${build}/${share}/${doorKey(doors)}/${open}`, () =>
      buildingAsset(this.kindId, build, share, doors, open)
    )
    this.plate.use(`plate/${kind.size}/${build}`, () => plateAsset(kind.size, build))
    this.body.root.scale.set(1 + this.pulse * 0.04, 1 - this.pulse * 0.06, 1 + this.pulse * 0.04)
    const H = kind.roof === "gable" ? 20 : kind.stories * 32
    this.marker.root.position.set(
      0,
      (H +
        (kind.topper === "chimney" ? 24 : kind.topper === "cupola" ? 25 : kind.topper === "flag" ? 24 : kind.topper === "sails" ? 16 : 0) +
        8) /
        Math.cos(Math.PI / 6),
      0
    )
    this.marker.root.visible = look.problem && look.build >= 1
    this.motion.root.visible = look.build >= 1 && (kind.topper === "flag" || kind.topper === "sails")
    if (kind.topper === "flag") {
      this.wave += dt * (look.working ? 6 : 3)
      this.motion.use("flag/" + this.kindId, () => makeFlag(this.kindId))
      const a = kind.half * U,
        pitch = (2 * a) / kind.bays
      this.motion.root.position.copy(vertex3([-a + pitch * (kind.bays - 0.5), -a + pitch * 0.5, H + 24]))
      this.motion.root.rotation.y = Math.sin(this.wave) * 0.15
      this.motion.root.scale.set(1 + Math.sin(this.wave) * 0.12, 1, 1 + Math.sin(this.wave) * 0.12)
    } else if (kind.topper === "sails") {
      if (look.working) this.wave += dt * 3.6
      this.motion.use("mill-sails", makeSails)
      this.motion.root.position.copy(vertex3([kind.half * U + 3 * U, 0, H - 6]))
      this.motion.root.rotation.x = this.wave
    }
    this.puff -= dt
    if (look.working && kind.topper === "chimney" && look.build >= 1 && this.puff <= 0) {
      this.rings.push(0)
      if (this.rings.length > 3) this.rings.shift()
      this.puff = 0.7
    }
    this.rings = this.rings.map((age) => age + dt / 1.8).filter((age) => age < 1)
    const a = kind.half * U,
      pitch = (2 * a) / kind.bays,
      u = -a + pitch * 0.5,
      v = -a + pitch * 0.5
    this.smokes.forEach((smoke, i) => {
      const t = this.rings[i]
      smoke.root.visible = t !== undefined
      if (t === undefined) return
      const r = Math.round(4 + t * 7)
      smoke.use("smoke-ring/" + r, () => {
        const d = new Drawing("smoke-ring", "Smoke", "")
        d.line(
          Array.from({ length: 25 }, (_, j): Vertex => [
            (Math.cos((j / 24) * Math.PI * 2) * r) / 64,
            (-Math.cos((j / 24) * Math.PI * 2) * r) / 64,
            Math.sin((j / 24) * Math.PI * 2) * r
          ]),
          1,
          0x3d4943,
          0.55
        )
        return d.asset
      })
      smoke.alpha = 1 - t
      smoke.root.position.copy(vertex3([u + (Math.sin(t * 5) * 1.5) / 64, v - (Math.sin(t * 5) * 1.5) / 64, H + 24 + t * 34]))
    })
    this.emphasis(emphasis)
  }
  override orient() {
    this.marker.root.rotation.y = this.stage.heading - Math.PI / 4
    for (const smoke of this.smokes) smoke.root.rotation.y = this.stage.heading - Math.PI / 4
  }
}

export class HouseView extends WorldView {
  private body: ModelHandle
  private plate: ModelHandle
  private n = 0.03
  constructor(stage: GameScene, entity: number) {
    super(stage, entity)
    this.body = this.model()
    this.plate = this.model()
  }
  place(x: number, y: number) {
    this.n = hash(x, y)
    this.anchor.x = x + 0.5
    this.anchor.y = y + 0.5
    this.group.position.copy(vertex3([this.anchor.x, this.anchor.y, 0]))
  }
  update(look: HouseLook, emphasis: Emphasis) {
    const build = quantizeBuild(look.build),
      share = look.site === null ? null : Math.round(look.site * 3) / 3,
      doors = { ...noDoors, ...look.doors }
    this.body.use(`home/${look.tier}/${homeKey(this.n)}/${build}/${share}/${doorKey(doors)}`, () =>
      homeAsset(look.tier, this.n, build, share, doors)
    )
    this.plate.use(`plate/1/${build}`, () => plateAsset(1, build))
    this.emphasis(emphasis)
  }
}

export class TreeView extends WorldView {
  private body: ModelHandle
  private variant = treeVariant(0, 0)
  constructor(stage: GameScene, entity: number) {
    super(stage, entity)
    this.body = this.model()
  }
  place(x: number, y: number) {
    this.variant = treeVariant(x, y)
    this.body.root.scale.setScalar(this.variant.scale)
    this.body.root.position.copy(vertex3(this.variant.offset))
    this.anchor.x = x + 0.5
    this.anchor.y = y + 0.5
    this.group.position.copy(vertex3([this.anchor.x, this.anchor.y, 0]))
  }
  update(growth: number, emphasis: Emphasis) {
    const stage = growth >= GROWN.tree ? 1 : growth >= GROWN.tree / 2 ? 0.6 : 0.3,
      v = this.variant
    this.body.use(`tree/${v.id}/${stage}`, () => makeTree(v.type, stage, "tree", { ...v.seed, segments: 32 }))
    this.emphasis(emphasis)
  }
}
export class RockView extends WorldView {
  private body: ModelHandle
  constructor(stage: GameScene, entity: number) {
    super(stage, entity)
    this.body = this.model()
  }
  place(x: number, y: number) {
    this.anchor.x = x + 0.5
    this.anchor.y = y + 0.5
    this.group.position.copy(vertex3([this.anchor.x, this.anchor.y, 0]))
  }
  update(ore: boolean, amount: number) {
    const full = amount > ROCK_AMOUNT / 2
    this.body.use(`rock/${ore}/${full}`, () => makeRock(ore, full))
  }
}
export class FieldView extends WorldView {
  private body: ModelHandle
  constructor(stage: GameScene, entity: number) {
    super(stage, entity)
    this.body = this.model()
  }
  place(x: number, y: number) {
    this.anchor.x = x + 0.5
    this.anchor.y = y + 0.5
    this.group.position.copy(vertex3([this.anchor.x, this.anchor.y, 0]))
  }
  update(growth: number) {
    const stage = Math.min(3, Math.floor((growth / GROWN.field) * 3)) as 0 | 1 | 2 | 3
    this.body.use("field/" + stage, () => makeField(stage))
  }
}

export class WalkerView extends WorldView {
  private body: ModelHandle
  private dress: PersonDress
  private cart: CartLook | null
  private faithDress: PersonDress | null = null
  private currentDress: PersonDress | null = null
  constructor(stage: GameScene, entity: number, dress: PersonDress, cart: CartLook | null) {
    super(stage, entity)
    this.dress = dress
    this.cart = cart
    this.body = this.model(false)
  }
  static forFigure(role: "carrier" | "walker", color: number, stage: GameScene, entity: number) {
    const n = hash(entity, 7)
    const view = new WalkerView(
      stage,
      entity,
      role === "carrier" ? carrierDress(n) : serviceDress(color, n, false),
      role === "carrier" ? cartLook(hash(entity, 31)) : null
    )
    if (role === "walker") view.faithDress = serviceDress(color, n, true)
    return view
  }
  update(x: number, y: number, dir: Point, phase: number, load: Load) {
    const dress = load.kind === "bell" && this.faithDress ? this.faithDress : this.dress
    // Costume colours vary per person without duplicating the same geometry.
    const canonicalDress = { ...dress, coat: 0xff0001, skin: 0xff0003, trim: dress.trim === 0xf7f8f4 ? dress.trim : 0xff0002 },
      canonicalCart = this.cart ? { ...this.cart, wood: { top: 0xff0004, left: 0xff0005, right: 0xff0006 } } : null
    if (this.currentDress !== dress) {
      this.currentDress = dress
      this.body.colors = new Map([[0xff0001, dress.coat], [0xff0002, dress.trim], [0xff0003, dress.skin],
        [0xff0004, this.cart?.wood.top ?? 0], [0xff0005, this.cart?.wood.left ?? 0], [0xff0006, this.cart?.wood.right ?? 0]])
    }
    const visualLoad = load.kind === "cart" ? { ...load, count: load.count >= 4 ? 4 : load.count >= 2 ? 2 : load.count > 0 ? 1 : 0 } : load
    const key = JSON.stringify([canonicalDress, canonicalCart, phase, visualLoad])
    this.body.use("walker/" + key, () => {
      const asset = makePerson("walker", "Walker", canonicalDress, visualLoad, canonicalCart, phase)
      const shadow = new Drawing("shadow", "Shadow", "")
      shadow.face(
        Array.from({ length: 24 }, (_, i): Vertex => {
          const t = (i / 24) * Math.PI * 2,
            sx = Math.cos(t) * 2.8,
            sy = Math.sin(t)
          return [sx / 64 + sy / 32, -sx / 64 + sy / 32, -0.02]
        }),
        0xe3e6de,
        0
      )
      asset.faces.push(...shadow.asset.faces)
      return asset
    })
    this.group.position.copy(vertex3([x, y, 0]))
    if (dir.x || dir.y) this.group.rotation.y = Math.atan2(-dir.y, dir.x)
    this.body.alpha = this.alpha
  }
}
