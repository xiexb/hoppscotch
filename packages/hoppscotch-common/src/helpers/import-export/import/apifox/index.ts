/**
 * Apifox import utilities.
 *
 * Provides JSON Schema → HoppRESTSchemaNode conversion for importing
 * Apifox project exports into Hoppscotch.
 */

export {
  jsonSchemaToSchemaNode,
  flattenSchemaCollection,
  buildRefMap,
  type RefMap,
  type ConvertOptions,
} from "./jsonSchemaToSchemaNode"

export {
  type ApifoxJsonSchemaProperty,
  type ApifoxSchemaModel,
  type ApifoxSchemaFolder,
  type ApifoxProject,
  isSchemaModel,
} from "./types"

export { hoppApifoxImporter } from "./importer"
