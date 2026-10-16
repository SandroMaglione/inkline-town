import { buildingDimensions, makeBuilding } from "./buildings.ts"
import { dressedBuilding, scaffoldAsset } from "./upgrade-dress.ts"
import type { InkAsset } from "./primitives.ts"

export function upgradeCatalogue(): InkAsset[] {
  const upgrades = ([
    ["townhall", 1, "guildhall", "Guildhall", "A steep-roofed guild house with a tall clock tower, stone balcony, dormers and hanging guild banners."],
    ["townhall", 2, "cityhall", "City hall", "A domed civic palace with lower wings, corner pavilions, a ceremonial stair and columned portico."],
    ["warehouse", 1, "depot", "Depot", "A braced gantry spans the cargo apron, with its pulley and load inside the yard."],
    ["bakery", 1, "ovenworks", "Ovenworks", "A second brick flue rises out of the bakehouse behind the open oven."],
    ["quarry", 1, "masonry", "Masonry", "A solid timber derrick and dressed blocks in an open stonecutting yard."],
    ["farm", 1, "estate", "Estate", "A raised dovecote and open hay shelter occupy the farm's spare yard."],
    ["firewatch", 1, "fire-brigade", "Fire brigade", "A hand pump and wheeled hose cart equip the existing bell lookout."]
  ] as const).map(([kind, level, id, title, note]) => ({
    ...dressedBuilding(kind, level, makeBuilding(kind), buildingDimensions(kind).height),
    id, title, note, reference: { type: "none" } as const
  }))
  const stages = [0.15, 0.5, 0.9].map(share => {
    const base = makeBuilding("townhall"), frame = scaffoldAsset(3, buildingDimensions("townhall").height, share)
    return { ...base, id: `upgrade-works-${Math.round(share * 100)}`, title: `Materials delivered · ${Math.round(share * 100)}%`,
      note: "Reusable scaffold bays, working platforms, ladders, canvas screens and incoming supplies.", reference: { type: "none" } as const,
      faces: [...base.faces, ...frame.faces], strokes: [...base.strokes, ...frame.strokes] }
  })
  const examples = ([
    ["carpenter",0,.5], ["warehouse",0,.65], ["quarry",0,.5],
    ["farm",0,.75], ["townhall",1,.5], ["townhall",2,.9]
  ] as const).map(([kind,level,share]) => {
    const base=level?upgrades.find(a=>a.id===(level===1?"guildhall":"cityhall"))!:makeBuilding(kind)
    const height=kind==="townhall"&&level===2?80:buildingDimensions(kind).height
    const frame=scaffoldAsset(base.footprint!,height,share)
    return {...base,id:`works-${kind}-${level}`,title:`${base.title} · works`,
      note:"The same construction generator, using only plot size, height and delivered share.",reference:{type:"none"} as const,
      faces:[...base.faces,...frame.faces],strokes:[...base.strokes,...frame.strokes]}
  })
  return [...upgrades, ...stages, ...examples]
}
