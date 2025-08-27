---
id: query-param-styles
title: "Guide: Query Parameter Styles"
sidebar_label: Query Parameter Styles
---id: query-param-styles
title: Guide: Query Parameter Styles
sidebar_label: Query Param Styles
---

# Guide: Query Parameter Styles

Related: [Configuration](configuration.md) (style/explode origins), [Endpoint Tool Generation](endpoint-tool-generation.md)

Array parameter forms implemented:

| Style | explode | Example Input | Serialized |
| ----- | ------- | ------------- | ---------- |
| form  | true    | foo=[1,2]     | foo=1&foo=2 |
| form  | false   | foo=[1,2]     | foo=1,2 |
| spaceDelimited | true | foo=[a,b] | foo=a b |
| pipeDelimited | true | foo=[a,b] | foo=a|b |
| simple | N/A | (path typical) | comma separated |

Fallback: repeated key per element.

Next: [Handling Large / Binary Responses](handling-large-binary.md).
