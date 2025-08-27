[**oas-mcp**](../README.md)

***

# Interface: HttpResponseEnvelope

Defined in: [types/shared.ts:12](https://github.com/elwizard33/oas-mcp/blob/7cf9d567cc88511dc791c0b4404a83049800ec70/src/types/shared.ts#L12)

## Properties

### status

> **status**: `number`

Defined in: [types/shared.ts:13](https://github.com/elwizard33/oas-mcp/blob/7cf9d567cc88511dc791c0b4404a83049800ec70/src/types/shared.ts#L13)

***

### ok

> **ok**: `boolean`

Defined in: [types/shared.ts:14](https://github.com/elwizard33/oas-mcp/blob/7cf9d567cc88511dc791c0b4404a83049800ec70/src/types/shared.ts#L14)

***

### headers

> **headers**: `Record`\<`string`, `string`\>

Defined in: [types/shared.ts:15](https://github.com/elwizard33/oas-mcp/blob/7cf9d567cc88511dc791c0b4404a83049800ec70/src/types/shared.ts#L15)

***

### body?

> `optional` **body**: `string`

Defined in: [types/shared.ts:16](https://github.com/elwizard33/oas-mcp/blob/7cf9d567cc88511dc791c0b4404a83049800ec70/src/types/shared.ts#L16)

***

### json?

> `optional` **json**: `any`

Defined in: [types/shared.ts:17](https://github.com/elwizard33/oas-mcp/blob/7cf9d567cc88511dc791c0b4404a83049800ec70/src/types/shared.ts#L17)

***

### base64?

> `optional` **base64**: `string`

Defined in: [types/shared.ts:18](https://github.com/elwizard33/oas-mcp/blob/7cf9d567cc88511dc791c0b4404a83049800ec70/src/types/shared.ts#L18)

***

### sse?

> `optional` **sse**: `object`[]

Defined in: [types/shared.ts:19](https://github.com/elwizard33/oas-mcp/blob/7cf9d567cc88511dc791c0b4404a83049800ec70/src/types/shared.ts#L19)

#### event?

> `optional` **event**: `string`

#### data

> **data**: `any`

***

### error?

> `optional` **error**: [`ToolError`](ToolError.md)

Defined in: [types/shared.ts:20](https://github.com/elwizard33/oas-mcp/blob/7cf9d567cc88511dc791c0b4404a83049800ec70/src/types/shared.ts#L20)

***

### elapsedMs

> **elapsedMs**: `number`

Defined in: [types/shared.ts:21](https://github.com/elwizard33/oas-mcp/blob/7cf9d567cc88511dc791c0b4404a83049800ec70/src/types/shared.ts#L21)
