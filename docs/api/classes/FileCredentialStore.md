[**oas-mcp**](../README.md)

***

# Class: FileCredentialStore

Defined in: cred/store.ts:19

## Implements

- `CredentialStore`

## Constructors

### Constructor

> **new FileCredentialStore**(`opts`): `FileCredentialStore`

Defined in: cred/store.ts:22

#### Parameters

##### opts

`FileCredentialStoreOptions` = `{}`

#### Returns

`FileCredentialStore`

## Methods

### load()

> **load**(): `Promise`\<`CredentialRecord`\>

Defined in: cred/store.ts:27

#### Returns

`Promise`\<`CredentialRecord`\>

#### Implementation of

`CredentialStore.load`

***

### save()

> **save**(`creds`): `Promise`\<`void`\>

Defined in: cred/store.ts:45

#### Parameters

##### creds

`CredentialRecord`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`CredentialStore.save`
