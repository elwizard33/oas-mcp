import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'category', label: 'Introduction', collapsed: false, items: [
        'overview', 'quick-start'
      ]
    },
    {
      type: 'category', label: 'Getting Started', items: [
        'installation', 'cli-usage', 'frontend-ui', 'configuration'
      ]
    },
    {
      type: 'category', label: 'Core Concepts', items: [
        'openapi-parsing-caching', 'endpoint-tool-generation', 'authentication-credentials', 'rate-limiting', 'retry-policy', 'streaming-responses', 'metrics', 'security'
      ]
    },
    {
      type: 'category', label: 'Guides', items: [
        'adding-credentials', 'oauth-flows', 'multipart-file-uploads', 'query-param-styles', 'handling-large-binary', 'filtering-endpoints'
      ]
    },
    {
      type: 'category', label: 'API Reference', items: [
  { type: 'doc', id: 'api/README', label: 'API Index' }
      ]
    },
    {
      type: 'category', label: 'Advanced Topics', items: [
        'name-collision-modes', 'credential-store', 'schema-composition-discriminators', 'streaming-event-contract'
      ]
    },
    {
      type: 'category', label: 'Contributing', items: [
        'development-setup', 'architecture-overview'
      ]
    },
    'changelog-link'
  ]
};

export default sidebars;
