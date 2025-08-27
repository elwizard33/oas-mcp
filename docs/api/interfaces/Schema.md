[**oas-mcp**](../README.md)

***

# Interface: Schema

Defined in: openapi/types.ts:3

## Properties

### type?

> `optional` **type**: `string`

Defined in: openapi/types.ts:4

***

### format?

> `optional` **format**: `string`

Defined in: openapi/types.ts:4

***

### description?

> `optional` **description**: `string`

Defined in: openapi/types.ts:4

***

### default?

> `optional` **default**: `any`

Defined in: openapi/types.ts:4

***

### enum?

> `optional` **enum**: `any`[]

Defined in: openapi/types.ts:5

***

### properties?

> `optional` **properties**: `Record`\<`string`, `Schema`\>

Defined in: openapi/types.ts:5

***

### items?

> `optional` **items**: `Schema`

Defined in: openapi/types.ts:5

***

### required?

> `optional` **required**: `string`[]

Defined in: openapi/types.ts:5

***

### allOf?

> `optional` **allOf**: `Schema`[]

Defined in: openapi/types.ts:7

***

### oneOf?

> `optional` **oneOf**: `Schema`[]

Defined in: openapi/types.ts:8

***

### anyOf?

> `optional` **anyOf**: `Schema`[]

Defined in: openapi/types.ts:9

***

### discriminator?

> `optional` **discriminator**: `object`

Defined in: openapi/types.ts:10

#### propertyName

> **propertyName**: `string`

#### mapping?

> `optional` **mapping**: `Record`\<`string`, `string`\>

***

### \_mergedAllOf?

> `optional` **\_mergedAllOf**: `boolean`

Defined in: openapi/types.ts:12
