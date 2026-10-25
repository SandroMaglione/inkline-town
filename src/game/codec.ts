/**
 * An Effect schema as a Ritmo codec: decodes saved JSON, and encodes values
 * back to it (the helper from the Ritmo skill's `playbooks/effect.md`). Every
 * saved component and resource in `schema.ts` passes its schema through it.
 */
import { Schema } from "effect"

export const codec = <S extends Schema.Top & { readonly DecodingServices: never; readonly EncodingServices: never }>(schema: S) => {
  const json = Schema.toCodecJson(schema)
  return {
    "~standard": Schema.toStandardSchemaV1(json)["~standard"],
    "~encode": Schema.toStandardSchemaV1(Schema.flip(json))
  }
}
