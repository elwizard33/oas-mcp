[**oas-mcp**](../README.md)

***

# Interface: HttpResponseEnvelope

Defined in: types/shared.ts:12

## Properties

### status

> **status**: `number`

Defined in: types/shared.ts:13

***

### ok

> **ok**: `boolean`

Defined in: types/shared.ts:14

***

### headers

> **headers**: `Record`\<`string`, `string`\>

Defined in: types/shared.ts:15

***

### body?

> `optional` **body**: `string`

Defined in: types/shared.ts:16

***

### json?

> `optional` **json**: `any`

Defined in: types/shared.ts:17

***

### base64?

> `optional` **base64**: `string`

Defined in: types/shared.ts:18

***

### sse?

> `optional` **sse**: `object`[]

Defined in: types/shared.ts:19

#### event?

> `optional` **event**: `string`

#### data

> **data**: `any`

***

### error?

> `optional` **error**: [`ToolError`](ToolError.md)

Defined in: types/shared.ts:20

***

### elapsedMs

> **elapsedMs**: `number`

Defined in: types/shared.ts:21
