[**oas-mcp**](../README.md)

***

# Class: MemoryCredentialStore

Defined in: [cred/store.ts:11](https://github.com/elwizard33/oas-mcp/blob/f93270cb7f8cf145e9a87cf91a1bfb2c12486f7e/src/cred/store.ts#L11)

## Implements

- `CredentialStore`

## Constructors

### Constructor

> **new MemoryCredentialStore**(): `MemoryCredentialStore`

#### Returns

`MemoryCredentialStore`

## Methods

### load()

> **load**(): `Promise`\<`CredentialRecord`\>

Defined in: [cred/store.ts:13](https://github.com/elwizard33/oas-mcp/blob/f93270cb7f8cf145e9a87cf91a1bfb2c12486f7e/src/cred/store.ts#L13)

#### Returns

`Promise`\<`CredentialRecord`\>

#### Implementation of

`CredentialStore.load`

***

### save()

> **save**(`creds`): `Promise`\<`void`\>

Defined in: [cred/store.ts:14](https://github.com/elwizard33/oas-mcp/blob/f93270cb7f8cf145e9a87cf91a1bfb2c12486f7e/src/cred/store.ts#L14)

#### Parameters

##### creds

`CredentialRecord`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`CredentialStore.save`
