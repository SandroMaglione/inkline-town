/**
 * The town's shader bits for Pixi 3D's materials (see the `pixijs-3d` skill,
 * `custom-shaders`). Every material here is a `FlatMaterial`, unlit, drawn in
 * display space: colours are written as authored, as three.js showed them.
 *
 * The renderer runs on WebGPU where the browser has it and on WebGL elsewhere
 * (`backend` in `gpu.ts`), so each bit carries its code twice: `gpu` in WGSL
 * and `gl` in GLSL. A change to one half belongs in the other too.
 */
import type { ShaderBit } from "@pixi/3d"

/** sRGB ⇄ linear light, piecewise, as three.js encoded its output. */
const colourSpace = `
vec3 inkToLinear(vec3 c){ return mix(pow(c*0.9478672986+vec3(0.0521327014),vec3(2.4)), c*0.0773993808, vec3(lessThan(c,vec3(0.04045)))); }
vec3 inkToDisplay(vec3 c){ return mix(pow(c,vec3(0.41666))*1.055-vec3(0.055), c*12.92, vec3(lessThanEqual(c,vec3(0.0031308)))); }
vec3 inkRGB(vec3 c){ return pow(c,vec3(2.2)); }
float inkHash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float inkNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(inkHash(i),inkHash(i+vec2(1,0)),f.x),mix(inkHash(i+vec2(0,1)),inkHash(i+vec2(1,1)),f.x),f.y); }
`
const colourSpaceGpu = `
fn inkToLinear(c: vec3<f32>) -> vec3<f32> { return select(pow(c*0.9478672986+vec3<f32>(0.0521327014),vec3<f32>(2.4)), c*0.0773993808, c<vec3<f32>(0.04045)); }
fn inkToDisplay(c: vec3<f32>) -> vec3<f32> { return select(pow(c,vec3<f32>(0.41666))*1.055-vec3<f32>(0.055), c*12.92, c<=vec3<f32>(0.0031308)); }
fn inkRGB(c: vec3<f32>) -> vec3<f32> { return pow(c,vec3<f32>(2.2)); }
fn inkHash(p: vec2<f32>) -> f32 { return fract(sin(dot(p,vec2<f32>(127.1,311.7)))*43758.5453); }
fn inkNoise(p: vec2<f32>) -> f32 { let i=floor(p); var f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(inkHash(i),inkHash(i+vec2<f32>(1.0,0.0)),f.x),mix(inkHash(i+vec2<f32>(0.0,1.0)),inkHash(i+vec2<f32>(1.0,1.0)),f.x),f.y); }
`
/** Helpers every bit can call; required by the bits that use them. */
export const inkCommonBit: ShaderBit = { name: "inkline-common", gpu: { header: colourSpaceGpu }, gl: { header: colourSpace } }

/**
 * Faces sit a little behind their ink, so a stroke drawn on a face's edge
 * always shows: three.js's polygon offset (factor 6, units 2), scaled with
 * the face's slope as that was.
 *
 * WebGL writes it into the fragment's depth. A Pixi 3D material can't write a
 * fragment's depth on WebGPU, so there each vertex is moved back instead, by
 * the slope its face's normal gives under an orthographic camera: the same
 * depth, for a flat face. That needs the picture's size in pixels
 * (`facePixels`, which `draw` in `materials.ts` keeps).
 */
export const faceBiasBit: ShaderBit = {
  name: "inkline-face-bias",
  bindings: { material: { facePixels: "vec2<f32>" } },
  gpu: {
    vertex: {
      afterTransform: `{
        let faceN = (camera.uViewMatrix * vec4<f32>(worldNormal, 0.0)).xyz;
        let faceP = camera.uProjectionMatrix;
        let faceAcross = abs(faceN.x) / abs(faceP[0][0] * material.facePixels.x);
        let faceUp = abs(faceN.y) / abs(faceP[1][1] * material.facePixels.y);
        let faceSlope = abs(faceP[2][2]) * 2.0 * max(faceAcross, faceUp) / max(abs(faceN.z), 1e-6);
        clipPosition.z = min(clipPosition.z + (6.0 * faceSlope + 2.0 / 16777216.0) * clipPosition.w, clipPosition.w);
      }`
    }
  },
  gl: { fragment: { end: `{ float faceSlope = max(abs(dFdx(gl_FragCoord.z)), abs(dFdy(gl_FragCoord.z))); gl_FragDepth = gl_FragCoord.z + 6.0 * faceSlope + 2.0 / 16777216.0; }` } }
}

/** A copy of a shared model in the live town: its colour (already tinted) and opacity from its own material. */
export const plainBit: ShaderBit = {
  name: "inkline-plain",
  bindings: { material: { color: "vec4<f32>" } },
  gpu: { fragment: { material: `{ albedo = material.color.rgb; alpha = material.color.a; }` } },
  gl: { fragment: { material: `{ albedo = material.color.rgb; alpha = material.color.a; }` } }
}

/**
 * A sharp contour's edge, shown only where it outlines the model: one of its
 * two faces turns towards the camera and the other away.
 */
export const inkSilhouetteBit: ShaderBit = {
  name: "inkline-silhouette",
  attributes: { aInkNormalA: "float32x3", aInkNormalB: "float32x3" },
  interStage: { vInkEdge: "f32" },
  gpu: {
    vertex: {
      beforeTransform: `{
        let toCamera = vec3<f32>(camera.uViewMatrix[0][2], camera.uViewMatrix[1][2], camera.uViewMatrix[2][2]);
        let turn = mat3x3<f32>(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz);
        output.vInkEdge = step(0.0, -dot(turn * input.aInkNormalA, toCamera) * dot(turn * input.aInkNormalB, toCamera));
      }`
    },
    fragment: { material: `{ if (input.vInkEdge < 0.5) { discard; } }` }
  },
  gl: {
    vertex: {
      beforeTransform: `{
        vec3 toCamera = vec3(uViewMatrix[0][2], uViewMatrix[1][2], uViewMatrix[2][2]);
        mat3 turn = mat3(modelMatrix);
        vInkEdge = step(0.0, -dot(turn * aInkNormalA, toCamera) * dot(turn * aInkNormalB, toCamera));
      }`
    },
    fragment: { material: `{ if (vInkEdge < 0.5) discard; }` }
  }
}

/**
 * A stroke a world width across, turned to face the camera, with round ends
 * (what three.js's `LineSegments2` drew with `worldUnits`), at its line's
 * depth, with an edge a pixel soft.
 */
export const inkLineBit: ShaderBit = {
  name: "inkline-line",
  attributes: { aLineStart: "float32x3", aLineEnd: "float32x3", aLineCorner: "float32x2" },
  interStage: { vLineAlong: "f32", vLineAcross: "f32", vLineLength: "f32" },
  bindings: { material: { lineWidth: "f32", lineAlpha: "f32" } },
  gpu: {
    vertex: {
      afterTransform: `{
        let lineView = camera.uViewMatrix * modelMatrix;
        let lineA = (lineView * vec4<f32>(input.aLineStart, 1.0)).xyz;
        let lineB = (lineView * vec4<f32>(input.aLineEnd, 1.0)).xyz;
        let lineD = lineB.xy - lineA.xy;
        let lineL = length(lineD);
        var lineDir = vec2<f32>(1.0, 0.0);
        if (lineL > 1e-6) { lineDir = lineD / lineL; }
        let linePerp = vec2<f32>(-lineDir.y, lineDir.x);
        // One world unit beyond the stroke on every side, for its soft edge at any zoom.
        let lineReach = material.lineWidth * 0.5 + 1.0;
        let lineFar = input.aLineCorner.x > 0.5;
        let lineExt = select(-lineReach, lineReach, lineFar);
        let lineP = select(lineA, lineB, lineFar) + vec3<f32>(lineDir * lineExt + linePerp * input.aLineCorner.y * lineReach, 0.0);
        output.vLineAlong = select(0.0, lineL, lineFar) + lineExt;
        output.vLineAcross = input.aLineCorner.y * lineReach;
        output.vLineLength = lineL;
        clipPosition = camera.uProjectionMatrix * vec4<f32>(lineP, 1.0);
      }`
    },
    fragment: {
      material: `{
        var lineD = abs(input.vLineAcross);
        if (input.vLineAlong < 0.0) { lineD = length(vec2<f32>(input.vLineAlong, input.vLineAcross)); }
        else if (input.vLineAlong > input.vLineLength) { lineD = length(vec2<f32>(input.vLineAlong - input.vLineLength, input.vLineAcross)); }
        let lineNorm = lineD / max(material.lineWidth, 1e-4);
        let lineSoft = 0.5 * fwidth(lineNorm);
        alpha = (1.0 - smoothstep(0.5 - lineSoft, 0.5 + lineSoft, lineNorm)) * material.lineAlpha;
        if (alpha < 0.004) { discard; }
      }`
    }
  },
  gl: {
    vertex: {
      afterTransform: `{
        vec3 lineA = (uViewMatrix * modelMatrix * vec4(aLineStart, 1.0)).xyz;
        vec3 lineB = (uViewMatrix * modelMatrix * vec4(aLineEnd, 1.0)).xyz;
        vec2 lineD = lineB.xy - lineA.xy;
        float lineL = length(lineD);
        vec2 lineDir = lineL > 1e-6 ? lineD / lineL : vec2(1.0, 0.0);
        vec2 linePerp = vec2(-lineDir.y, lineDir.x);
        float lineHalf = material.lineWidth * 0.5;
        // One world unit beyond the stroke on every side, for its soft edge at any zoom.
        float lineReach = lineHalf + 1.0;
        bool lineFar = aLineCorner.x > 0.5;
        float lineExt = lineFar ? lineReach : -lineReach;
        vec3 lineP = (lineFar ? lineB : lineA) + vec3(lineDir * lineExt + linePerp * aLineCorner.y * lineReach, 0.0);
        vLineAlong = (lineFar ? lineL : 0.0) + lineExt;
        vLineAcross = aLineCorner.y * lineReach;
        vLineLength = lineL;
        gl_Position = uProjectionMatrix * vec4(lineP, 1.0);
      }`
    },
    fragment: {
      material: `{
        float lineD = vLineAlong < 0.0 ? length(vec2(vLineAlong, vLineAcross)) : vLineAlong > vLineLength ? length(vec2(vLineAlong - vLineLength, vLineAcross)) : abs(vLineAcross);
        float lineNorm = lineD / max(material.lineWidth, 1e-4);
        float lineSoft = 0.5 * fwidth(lineNorm);
        alpha = (1.0 - smoothstep(0.5 - lineSoft, 0.5 + lineSoft, lineNorm)) * material.lineAlpha;
        if (alpha < 0.004) discard;
      }`
    }
  }
}

/** The surface shading of a structure: wear, care, snow, fire and the hazards' signs, in model space. */
const shade = `
if(surfBounds.w>0.5){
  vec3 dc=inkToLinear(albedo);
  vec3 p=vSurfacePosition; vec3 n=normalize(vSurfaceNormal);
  float H=surfBounds.y, halfWidth=surfBounds.x;
  float wear=surfState.x,care=surfState.y,snow=surfState.z,burn=surfState.w;
  float fireRisk=surfHazards.x,health=surfHazards.y,order=surfHazards.z,sick=surfHazards.w;
  float roof=step(H-0.15,p.y)*smoothstep(0.12,0.45,abs(n.y));
  float wall=(1.0-roof)*step(0.1,p.y)*step(p.y,H+0.1)*(1.0-surfGlass);
  vec2 uv=abs(n.x)>abs(n.z)?p.zy:p.xy;
  float g=inkNoise(uv*0.32+surfBounds.z);
  float lower=1.0-smoothstep(0.0,H*0.7,p.y);
  float dirt=wear*wall*(0.16+0.45*lower+0.20*g);
  dc=mix(dc,inkRGB(vec3(0.60,0.62,0.52)),dirt);
  float plaster=wear*wall*smoothstep(0.58,0.76,g)*(0.4+0.6*lower);
  vec2 brick=vec2((uv.x+mod(floor(uv.y/1.8),2.0)*1.8)/3.6,uv.y/1.8);
  float mortar=max(1.0-smoothstep(0.025,0.08,fract(brick.y)),1.0-smoothstep(0.025,0.06,fract(brick.x)));
  dc=mix(dc,inkRGB(mix(vec3(0.68,0.53,0.40),vec3(0.84,0.79,0.68),mortar)),plaster*0.9);
  float crack=abs(uv.x-halfWidth*0.36-sin(uv.y*0.64)*0.48-sin(uv.y*1.5)*0.16);
  float crackMask=(1.0-smoothstep(0.045,0.10,crack))*smoothstep(H*0.25,H*0.4,p.y)*step(p.y,H*0.92);
  dc=mix(dc,inkRGB(vec3(0.39,0.43,0.36)),crackMask*wear*wall*0.85);
  float moss=roof*wear*smoothstep(0.3,0.8,inkNoise(p.xz*0.30))*0.45;
  dc=mix(dc,inkRGB(vec3(0.47,0.54,0.37)),moss);
  dc=mix(dc,inkRGB(vec3(0.97,0.96,0.90)),care*wall*0.12);
  float damp=(health*0.45+sick*0.65)*wall*lower*smoothstep(0.35,0.75,g);
  dc=mix(dc,inkRGB(vec3(0.48,0.59,0.43)),damp);
  if(surfGlass>0.5){
    float fissure=abs(fract((uv.x+uv.y*0.38+sin(uv.y*2.0)*0.18)/3.2)-0.5);
    float broken=(1.0-smoothstep(0.025,0.065,fissure))*order;
    dc=mix(dc,inkRGB(vec3(0.25,0.31,0.29)),broken*0.95);
    dc=mix(dc,inkRGB(vec3(0.58,0.69,0.45)),sick*0.35);
    float warm=care*0.6+burn*(0.75+0.15*sin(surfTime*9.0+p.x*2.0));
    dc=mix(dc,inkRGB(vec3(1.0,0.76,0.36)),warm);
  }
  float soot=(roof+wall*0.5)*burn*(0.35+inkNoise(p.xz*0.27)*0.50);
  dc=mix(dc,inkRGB(vec3(0.28,0.31,0.27)),soot);
  float heat=roof*burn*pow(inkNoise(p.xz*0.45+vec2(0.0,-surfTime*1.3)),5.0);
  dc=mix(dc,inkRGB(vec3(0.99,0.49,0.19)),heat*0.75);
  dc=mix(dc,inkRGB(vec3(0.80,0.63,0.43)),roof*fireRisk*0.15*(0.7+0.3*sin(surfTime*3.0)));
  float frost=roof*snow*smoothstep(-0.05,0.22,inkNoise(p.xz*0.65)+smoothstep(H,H+2.0,p.y)*0.15);
  dc=mix(dc,inkRGB(vec3(0.97,0.98,0.96)),frost);
  albedo=inkToDisplay(dc);
}
`
/** `shade` in WGSL, line for line. */
const shadeGpu = `
if(surfBounds.w>0.5){
  var dc=inkToLinear(albedo);
  let p=input.vSurfacePosition; let n=normalize(input.vSurfaceNormal);
  let H=surfBounds.y; let halfWidth=surfBounds.x;
  let wear=surfState.x; let care=surfState.y; let snow=surfState.z; let burn=surfState.w;
  let fireRisk=surfHazards.x; let health=surfHazards.y; let order=surfHazards.z; let sick=surfHazards.w;
  let roof=step(H-0.15,p.y)*smoothstep(0.12,0.45,abs(n.y));
  let wall=(1.0-roof)*step(0.1,p.y)*step(p.y,H+0.1)*(1.0-surfGlass);
  let uv=select(p.xy,p.zy,abs(n.x)>abs(n.z));
  let g=inkNoise(uv*0.32+surfBounds.z);
  let lower=1.0-smoothstep(0.0,H*0.7,p.y);
  let dirt=wear*wall*(0.16+0.45*lower+0.20*g);
  dc=mix(dc,inkRGB(vec3<f32>(0.60,0.62,0.52)),dirt);
  let plaster=wear*wall*smoothstep(0.58,0.76,g)*(0.4+0.6*lower);
  let course=floor(uv.y/1.8);
  let brick=vec2<f32>((uv.x+(course-2.0*floor(course*0.5))*1.8)/3.6,uv.y/1.8);
  let mortar=max(1.0-smoothstep(0.025,0.08,fract(brick.y)),1.0-smoothstep(0.025,0.06,fract(brick.x)));
  dc=mix(dc,inkRGB(mix(vec3<f32>(0.68,0.53,0.40),vec3<f32>(0.84,0.79,0.68),mortar)),plaster*0.9);
  let crack=abs(uv.x-halfWidth*0.36-sin(uv.y*0.64)*0.48-sin(uv.y*1.5)*0.16);
  let crackMask=(1.0-smoothstep(0.045,0.10,crack))*smoothstep(H*0.25,H*0.4,p.y)*step(p.y,H*0.92);
  dc=mix(dc,inkRGB(vec3<f32>(0.39,0.43,0.36)),crackMask*wear*wall*0.85);
  let moss=roof*wear*smoothstep(0.3,0.8,inkNoise(p.xz*0.30))*0.45;
  dc=mix(dc,inkRGB(vec3<f32>(0.47,0.54,0.37)),moss);
  dc=mix(dc,inkRGB(vec3<f32>(0.97,0.96,0.90)),care*wall*0.12);
  let damp=(health*0.45+sick*0.65)*wall*lower*smoothstep(0.35,0.75,g);
  dc=mix(dc,inkRGB(vec3<f32>(0.48,0.59,0.43)),damp);
  if(surfGlass>0.5){
    let fissure=abs(fract((uv.x+uv.y*0.38+sin(uv.y*2.0)*0.18)/3.2)-0.5);
    let broken=(1.0-smoothstep(0.025,0.065,fissure))*order;
    dc=mix(dc,inkRGB(vec3<f32>(0.25,0.31,0.29)),broken*0.95);
    dc=mix(dc,inkRGB(vec3<f32>(0.58,0.69,0.45)),sick*0.35);
    let warm=care*0.6+burn*(0.75+0.15*sin(surfTime*9.0+p.x*2.0));
    dc=mix(dc,inkRGB(vec3<f32>(1.0,0.76,0.36)),warm);
  }
  let soot=(roof+wall*0.5)*burn*(0.35+inkNoise(p.xz*0.27)*0.50);
  dc=mix(dc,inkRGB(vec3<f32>(0.28,0.31,0.27)),soot);
  let heat=roof*burn*pow(inkNoise(p.xz*0.45+vec2<f32>(0.0,-surfTime*1.3)),5.0);
  dc=mix(dc,inkRGB(vec3<f32>(0.99,0.49,0.19)),heat*0.75);
  dc=mix(dc,inkRGB(vec3<f32>(0.80,0.63,0.43)),roof*fireRisk*0.15*(0.7+0.3*sin(surfTime*3.0)));
  let frost=roof*snow*smoothstep(-0.05,0.22,inkNoise(p.xz*0.65)+smoothstep(H,H+2.0,p.y)*0.15);
  dc=mix(dc,inkRGB(vec3<f32>(0.97,0.98,0.96)),frost);
  albedo=inkToDisplay(dc);
}
`
/**
 * A structure's surface, worn, cared for, snowed on, burning, from its
 * material's state. Its time is the view's clock for a copy in the town
 * (`clock`), or the material's own for a model the catalogue and the labs
 * draw at a time they choose (`material`).
 */
export function surfaceBit(time: "clock" | "material"): ShaderBit {
  const read = `vec4 surfState=material.surfaceState; vec4 surfHazards=material.surfaceHazards; vec4 surfBounds=material.surfaceBounds; float surfTime=${time === "clock" ? "uTime" : "material.surfaceTime"};`
  const readGpu = `let surfState=material.surfaceState; let surfHazards=material.surfaceHazards; let surfBounds=material.surfaceBounds; let surfTime=${time === "clock" ? "global.uTime" : "material.surfaceTime"};`
  return {
    name: `inkline-surface-${time}`,
    requires: [inkCommonBit],
    interStage: { vSurfacePosition: "vec3<f32>", vSurfaceNormal: "vec3<f32>" },
    bindings: { material: { surfaceGlass: "f32", surfaceState: "vec4<f32>", surfaceHazards: "vec4<f32>", surfaceBounds: "vec4<f32>", ...(time === "material" ? { surfaceTime: "f32" as const } : {}) } },
    gpu: {
      vertex: { beforeTransform: `{ output.vSurfacePosition = position.xyz; output.vSurfaceNormal = normal; }` },
      fragment: { material: `{ ${readGpu} let surfGlass=material.surfaceGlass; ${shadeGpu} }` }
    },
    gl: {
      vertex: { beforeTransform: `{ vSurfacePosition = position.xyz; vSurfaceNormal = normal; }` },
      fragment: { material: `{ ${read} float surfGlass=material.surfaceGlass; ${shade} }` }
    }
  }
}
export const materialSurfaceBit = surfaceBit("material")
export const copySurfaceBit = surfaceBit("clock")
/** Glass and lit-window colours: the surface shading treats them as panes, not walls. */
export const GLASS = [0xdbe6ea, 0xf3dca6, 0xc9d6ee, 0xd5dae4, 0xdbe9e7]
