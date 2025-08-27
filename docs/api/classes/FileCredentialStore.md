[**oas-mcp**](../README.md)

***

# Class: FileCredentialStore

Defined in: [cred/store.ts:19](https://github.com/elwizard33/oas-mcp/blob/360f27d669a1e52ab74d11caab548be9e7506b7d/src/cred/store.ts#L19)

## Implements

- `CredentialStore`

## Constructors

### Constructor

> **new FileCredentialStore**(`opts`): `FileCredentialStore`

Defined in: [cred/store.ts:22](https://github.com/elwizard33/oas-mcp/blob/360f27d669a1e52ab74d11caab548be9e7506b7d/src/cred/store.ts#L22)

#### Parameters

##### opts

`FileCredentialStoreOptions` = `{}`

#### Returns

`FileCredentialStore`

## Methods

### load()

> **load**(): `Promise`\<`CredentialRecord`\>

Defined in: [cred/store.ts:63](https://github.com/elwizard33/oas-mcp/blob/360f27d669a1e52ab74d11caab548be9e7506b7d/src/cred/store.ts#L63)

#### Returns

`Promise`\<`CredentialRecord`\>

#### Implementation of

`CredentialStore.load`

***

### save()

> **save**(`creds`): `Promise`\<`void`\>

Defined in: [cred/store.ts:81](https://github.com/elwizard33/oas-mcp/blob/360f27d669a1e52ab74d11caab548be9e7506b7d/src/cred/store.ts#L81)

#### Parameters

##### creds

`CredentialRecord`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`CredentialStore.save`
