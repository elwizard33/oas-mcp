[**oas-mcp**](../README.md)

***

# Class: MemoryCredentialStore

Defined in: [cred/store.ts:11](https://github.com/elwizard33/oas-mcp/blob/8e2319f50a7dff4ff946a1b290930f93208fe588/src/cred/store.ts#L11)

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

Defined in: [cred/store.ts:13](https://github.com/elwizard33/oas-mcp/blob/8e2319f50a7dff4ff946a1b290930f93208fe588/src/cred/store.ts#L13)

#### Returns

`Promise`\<`CredentialRecord`\>

#### Implementation of

`CredentialStore.load`

***

### save()

> **save**(`creds`): `Promise`\<`void`\>

Defined in: [cred/store.ts:14](https://github.com/elwizard33/oas-mcp/blob/8e2319f50a7dff4ff946a1b290930f93208fe588/src/cred/store.ts#L14)

#### Parameters

##### creds

`CredentialRecord`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`CredentialStore.save`
