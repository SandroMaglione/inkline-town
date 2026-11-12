/**
 * The town's shader bits for Pixi 3D's materials (see the `pixijs-3d` skill,
 * `custom-shaders`). Every material here is a `FlatMaterial`, unlit, drawn in
 * display space: colours are written as authored, as three.js showed them.
 *
 * The renderer runs on WebGL (`scene.ts` asks for it), so each bit carries its
 * GLSL half only.
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
/** Helpers every bit can call; required by the bits that use them. */
export const inkCommonBit: ShaderBit = { name: "inkline-common", gl: { header: colourSpace } }

/**
 * Faces sit a little behind their ink, so a stroke drawn on a face's edge
 * always shows: three.js's polygon offset (factor 6, units 2), written into
 * the fragment's depth so it scales with the face's slope as that did.
 */
export const faceBiasBit: ShaderBit = {
  name: "inkline-face-bias",
  gl: { fragment: { end: `{ float faceSlope = max(abs(dFdx(gl_FragCoord.z)), abs(dFdy(gl_FragCoord.z))); gl_FragDepth = gl_FragCoord.z + 6.0 * faceSlope + 2.0 / 16777216.0; }` } }
}

/**
 * Shared models in the live town: each copy's colour (already tinted) and
 * opacity, and its building's wear, hazards and size for `surfaceBit`.
 */
export const instanceBit: ShaderBit = {
  name: "inkline-instance",
  bindings: { instance: { tint: "vec4<f32>", state: "vec4<f32>", hazards: "vec4<f32>", bounds: "vec4<f32>" }, material: { opacity: "f32" } },
  gl: { fragment: { material: `{ albedo = instance.tint.rgb; alpha = instance.tint.a * material.opacity; }` } }
}
/** One model drawn alone: its colour and opacity from the material. */
export const plainBit: ShaderBit = {
  name: "inkline-plain",
  bindings: { material: { color: "vec4<f32>" } },
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
/**
 * A structure's surface, worn, cared for, snowed on, burning: from each
 * shared copy's instance values in the town, or from the material's own for
 * one model drawn alone (the catalogue and the labs).
 */
export function surfaceBit(from: "instance" | "material"): ShaderBit {
  const read = from === "instance"
    ? `vec4 surfState=instance.state; vec4 surfHazards=instance.hazards; vec4 surfBounds=instance.bounds; float surfTime=uTime;`
    : `vec4 surfState=material.surfaceState; vec4 surfHazards=material.surfaceHazards; vec4 surfBounds=material.surfaceBounds; float surfTime=material.surfaceTime;`
  return {
    name: `inkline-surface-${from}`,
    requires: [inkCommonBit],
    interStage: { vSurfacePosition: "vec3<f32>", vSurfaceNormal: "vec3<f32>" },
    bindings: from === "instance"
      ? { instance: { tint: "vec4<f32>", state: "vec4<f32>", hazards: "vec4<f32>", bounds: "vec4<f32>" }, material: { surfaceGlass: "f32" } }
      : { material: { surfaceGlass: "f32", surfaceState: "vec4<f32>", surfaceHazards: "vec4<f32>", surfaceBounds: "vec4<f32>", surfaceTime: "f32" } },
    gl: {
      vertex: { beforeTransform: `{ vSurfacePosition = position.xyz; vSurfaceNormal = normal; }` },
      fragment: { material: `{ ${read} float surfGlass=material.surfaceGlass; ${shade} }` }
    }
  }
}
export const instanceSurfaceBit = surfaceBit("instance")
export const materialSurfaceBit = surfaceBit("material")
/** Glass and lit-window colours: the surface shading treats them as panes, not walls. */
export const GLASS = [0xdbe6ea, 0xf3dca6, 0xc9d6ee, 0xd5dae4, 0xdbe9e7]
