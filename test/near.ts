import assert from "node:assert/strict"

/**
 * deepEqual, but numbers may differ by a rounding error. The frozen baselines
 * were drawn on another machine, and Math.sin/cos may round the last bit
 * differently across CPUs, so an unchanged model can differ by one ULP.
 */
export const assertNear=(actual:unknown,expected:unknown,path="",tolerance=1e-9):void=>{
  if(typeof actual==="number"&&typeof expected==="number"){
    assert.ok(Math.abs(actual-expected)<=tolerance,`${path}: ${actual} ≠ ${expected}`)
    return
  }
  if(typeof actual!=="object"||actual===null||typeof expected!=="object"||expected===null){
    assert.equal(actual,expected,path)
    return
  }
  assert.equal(Array.isArray(actual),Array.isArray(expected),path)
  const a=actual as Record<string,unknown>,e=expected as Record<string,unknown>
  assert.deepEqual(Object.keys(a).sort(),Object.keys(e).sort(),path)
  for(const k of Object.keys(e))assertNear(a[k],e[k],`${path}/${k}`,tolerance)
}
