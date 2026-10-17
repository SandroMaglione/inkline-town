/**
 * Project lint rules (an oxlint JS plugin, see `.oxlintrc.json`).
 *
 * - `town/no-cast-escape`: no `as never` and no `as unknown as`, anywhere.
 *   Both switch the type checker off for a value. Build the value with its
 *   real type instead; if a library API cannot express it, fix the library.
 */
const noCastEscape = {
  meta: { type: "problem", docs: { description: "No `as never` and no `as unknown as`." } },
  create(context) {
    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type === "TSNeverKeyword") {
          context.report({ node, message: "`as never` switches type checking off for this value: give it its real type (if a library API cannot take it, fix the library)." })
        } else if (node.expression.type === "TSAsExpression" && node.expression.typeAnnotation.type === "TSUnknownKeyword") {
          context.report({ node, message: "`as unknown as` switches type checking off for this value: build it with its real type (if a library API cannot express it, fix the library)." })
        }
      }
    }
  }
}

export default {
  meta: { name: "town" },
  rules: {
    "no-cast-escape": noCastEscape
  }
}
