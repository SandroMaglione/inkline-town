import * as THREE from "three"
import {
  carrierDress,
  cartLook,
  serviceDress,
  type Alert,
  type BuildingLook,
  type HouseLook,
  type PersonDress,
  type CartLook,
  type Load,
  type Emphasis
} from "../art.ts"
import { kinds, home, GROWN, ROCK_AMOUNT, type KindId } from "../content.ts"
import { U, type Point } from "../iso.ts"
import { vertex3 } from "../asset-lab/renderer.ts"
import { Drawing, type Vertex } from "../asset-lab/primitives.ts"
import { makeSails, makeFlag } from "../asset-lab/buildings.ts"
import { makeMarker } from "../asset-lab/construction.ts"
import { makeRuin } from "../asset-lab/town-props.ts"
import { StructureEffects } from "./structure-effects.ts"
import { SmokePlume } from "./smoke-effects.ts"
import { surfaceState, type SurfaceState } from "./surface-state.ts"
import { makePerson, serviceCostume, type ServiceRole } from "../asset-lab/people.ts"
import { makeTree, makeRock, makeField, hash } from "../asset-lab/land.ts"
import { ModelHandle } from "./pool.ts"
import { buildingAsset, homeAsset, homeKey, doorKey, noDoors, quantizeBuild, plateAsset, treeVariant } from "./models.ts"
import type { GameScene, SceneNode } from "./scene.ts"

/** Winter's cold light complements the roof snow shader. */
const FROST = 0xe4ecf6
const multiply = (a: number, b: number) => {
  const c = (shift: number) => Math.round((((a >> shift) & 0xff) * ((b >> shift) & 0xff)) / 255)
  return (c(16) << 16) | (c(8) << 8) | c(0)
}

/** Surface parameters are independent of shared architectural geometry. */
export function structureState(look: {worn?: boolean; band?: "poor" | "plain" | "fine"; alert?: Alert | null; burning?: boolean; effects?: Partial<SurfaceState>}, winter: boolean) {
  return surfaceState({wear: look.worn?0.9:look.band==="poor"?0.55:0, care: look.band==="fine"?1:0, snow:Number(winter), burning:Number(!!look.burning), fireRisk:look.alert==="fire"?1:0, health:look.alert==="health"?1:0, order:look.alert==="order"?1:0,sick:look.alert==="sick"?1:0,...look.effects})
}

export class WorldView implements SceneNode {
  readonly group = new THREE.Group()
  readonly anchor = { x: 0, y: 0 }
  readonly stage: GameScene
  readonly entity: number
  protected models: Array<ModelHandle> = []
  protected effects: StructureEffects | null = null
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
  /** A tint for what it is like now (run down, a poor street), before winter's frost. */
  protected shade = 0xffffff
  /** A map view's colour over the whole model, so the view reads from the buildings and not only the ground under them. */
  protected viewTint: number | null = null
  protected emphasis(emphasis: Emphasis) {
    const tint = emphasis === "danger" ? 0xf3b5aa : this.viewTint !== null ? multiply(this.viewTint, this.stage.frost ? FROST : 0xffffff) : multiply(this.shade, this.stage.frost ? FROST : 0xffffff)
    for (const m of this.models) m.tint.setHex(tint)
  }
  destroy() {
    if (this.disposed) return
    this.disposed = true
    for (const m of this.models) m.dispose()
    this.effects?.dispose()
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
  private smoke: SmokePlume | null = null
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
    const signed = !!look.burning || (look.alert !== null && look.alert !== undefined)
    this.marker.root.visible = look.problem && look.build >= 1 && !signed
    const state = structureState(look,this.stage.frost)
    this.body.effects = build >= 1 ? state : surfaceState()
    this.body.effectBounds.set(kind.half * U * 32 * Math.SQRT2,H/Math.cos(Math.PI/6),this.entity%97/97,1)
    if(!this.effects&&build>=1&&(state.burning||state.fireRisk)){
      this.effects = new StructureEffects(buildingAsset(this.kindId,1,null,noDoors,0),H)
      this.group.add(this.effects.group)
    }
    this.effects?.set(build>=1?state:surfaceState());this.effects?.update(performance.now()/1000)
    this.shade = 0xffffff
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
    const smoking=look.working&&kind.topper==="chimney"&&look.build>=1&&!look.burning
    if(smoking&&!this.smoke){
      this.smoke=new SmokePlume()
      const a=kind.half*U,pitch=2*a/kind.bays
      this.smoke.group.position.copy(vertex3([-a+pitch*0.5,-a+pitch*0.5,H+24.3]))
      this.group.add(this.smoke.group)
    }
    this.smoke?.update(performance.now()/1000,Number(smoking))
    this.viewTint = look.tint ?? null
    this.emphasis(emphasis)
  }
  override orient() {
    this.marker.root.rotation.y = this.stage.heading - Math.PI / 4
  }
  override destroy() { this.smoke?.dispose();this.smoke=null;super.destroy() }

}

/** A closed home, washed a cold grey: nobody lives there. */
const CLOSED_SHADE = 0xa3abb6

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
    const state=structureState(look,this.stage.frost), H=home.tiers[look.tier].height
    this.body.effects=build>=1?state:surfaceState()
    this.body.effectBounds.set((home.half+(look.tier>=2?1:0))*U*32*Math.SQRT2,H/Math.cos(Math.PI/6),this.n,1)
    // Recreate emitters only if an actual architectural upgrade changes the roof.
    if(this.effects&&this.effects.group.userData.tier!==look.tier){this.effects.dispose();this.effects=null}
    if(!this.effects&&build>=1&&(state.burning||state.fireRisk)){
      this.effects=new StructureEffects(homeAsset(look.tier,this.n,1,null,noDoors),H)
      this.effects.group.userData.tier=look.tier;this.group.add(this.effects.group)
    }
    this.effects?.set(build>=1?state:surfaceState());this.effects?.update(performance.now()/1000)
    this.shade=look.closed?CLOSED_SHADE:0xffffff
    this.viewTint = look.tint ?? null
    this.emphasis(emphasis)
  }
}

/** What is left of a home or building, until it is cleared. */
export class RuinView extends WorldView {
  private body: ModelHandle
  private cause: "burnt" | "collapsed" | "derelict"
  constructor(cause: "burnt" | "collapsed" | "derelict", stage: GameScene, entity: number) {
    super(stage, entity)
    this.cause = cause
    this.body = this.model()
  }
  place(x: number, y: number, size: number) {
    this.anchor.x = x + size / 2
    this.anchor.y = y + size / 2
    this.group.position.copy(vertex3([this.anchor.x, this.anchor.y, 0]))
    this.body.use(`ruin/${this.cause}/${size}`, () => makeRuin(size, this.cause))
  }
  update(emphasis: Emphasis) {
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
  private variant = 0
  private cell = { x: 0, y: 0 }
  constructor(stage: GameScene, entity: number) {
    super(stage, entity)
    this.body = this.model()
  }
  place(x: number, y: number) {
    this.variant = Math.floor(hash(x,y)*6)
    this.cell = { x, y }
  }
  /** `w` × `h`: the cells of the outcrop this rock draws (see `rock-blocks.ts`); 0, drawn by a neighbour. */
  update(ore: boolean, amount: number, w = 1, h = 1) {
    this.group.visible = w > 0
    if (w === 0) return
    this.anchor.x = this.cell.x + w / 2
    this.anchor.y = this.cell.y + h / 2
    this.group.position.copy(vertex3([this.anchor.x, this.anchor.y, 0]))
    const full = amount > ROCK_AMOUNT / 2
    this.body.use(`rock/${ore}/${full}/${this.variant}/${w}x${h}`, () => makeRock(ore, full, this.variant, w, h))
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
  private serviceDresses = new Map<ServiceRole, PersonDress>()
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
    if (load.kind === "service" && !this.serviceDresses.has(load.role)) this.serviceDresses.set(load.role, serviceCostume(this.dress, load.role))
    const dress = load.kind === "service" ? this.serviceDresses.get(load.role)! : load.kind === "bell" && this.faithDress ? this.faithDress : this.dress
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
