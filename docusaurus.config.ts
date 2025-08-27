import { Config } from '@docusaurus/types';
import { themes } from 'prism-react-renderer';

const config: Config = {
  title: 'oas-mcp',
  tagline: 'OpenAPI → MCP Tool Server',
  url: 'https://elwizard33.github.io',
  baseUrl: '/oas-mcp/',
  favicon: 'img/favicon.ico',
  organizationName: 'elwizard33',
  projectName: 'oas-mcp',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en'] },
  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/elwizard33/oas-mcp/edit/main/',
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],
  themeConfig: {
    image: 'img/social-card.png',
    navbar: {
      title: 'oas-mcp',
      items: [
        { to: '/', label: 'Docs', position: 'left' },
        { to: '/api', label: 'API', position: 'left' },
        { href: 'https://github.com/elwizard33/oas-mcp', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        { title: 'Docs', items: [ { label: 'Overview', to: '/' }, { label: 'Quick Start', to: '/quick-start' } ] },
        { title: 'Community', items: [ { label: 'Issues', href: 'https://github.com/elwizard33/oas-mcp/issues' } ] },
        { title: 'More', items: [ { label: 'GitHub', href: 'https://github.com/elwizard33/oas-mcp' } ] },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} oas-mcp. MIT Licensed.`,
    },
    prism: { theme: themes.github, darkTheme: themes.dracula },
  },
};

export default config;
