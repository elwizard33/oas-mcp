---
id: multipart-file-uploads
title: Guide: Multipart & File Uploads
sidebar_label: Multipart & File Uploads
---

# Guide: Multipart & File Uploads

Related: [Endpoint Tool Generation](endpoint-tool-generation.md) (requestBody schema logic), [Handling Large / Binary Responses](handling-large-binary.md)

For operations declaring `multipart/form-data` the handler builds a streaming `FormData`.

Supported requestBody value shapes:
```ts
{ filename: 'a.txt', content: 'text' }
{ filename: 'a.bin', value: Uint8Array }
{ filename: 'a.bin', stream: Readable }
```

Strings & objects auto JSON-stringified when needed.

Skip manually setting Content-Type; boundary auto-managed.

Next: [Query Parameter Styles](query-param-styles.md).
