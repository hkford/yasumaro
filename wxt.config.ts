import { defineConfig } from 'wxt';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  outDir: 'dist',
  browser: 'chromium',
  manifestVersion: 3,

  vite: () => ({
    plugins: [
      tailwindcss(),
      svelte()
    ]
  }),

  manifest: (env) => {
    const isFirefox = env.browser === 'firefox';

    // permissions: remove favicon for Firefox
    const permissions = [
      'storage',
      'unlimitedStorage',
      'scripting',
      'activeTab',
      'notifications',
      'webRequest',
      'alarms',
    ];
    if (!isFirefox) {
      permissions.push('offscreen');
      permissions.push('favicon');
    }

    const manifest: any = {
      manifest_version: 3,
      name: '__MSG_extensionName__',
      short_name: '__MSG_extensionShortName__',
      version: '6.0.4',
      description: '__MSG_extensionDescription__',
      default_locale: 'en',
      homepage_url: 'https://github.com/armaniacs/yasumaro',
      icons: {
        '16': 'icons/icon16.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
      },
      permissions,
      optional_host_permissions: [
        'https://api-inference.huggingface.co/*',
        'https://api.openrouter.ai/*',
        'https://deepinfra.com/*',
        'https://cerebras.ai/*',
        'https://ai-gateway.helicone.ai/*',
        'https://api.publicai.co/*',
        'https://api.venice.ai/*',
        'https://api.scaleway.ai/*',
        'https://api.synthetic.new/*',
        'https://api.stima.tech/*',
        'https://nano-gpt.com/*',
        'https://api.poe.com/*',
        'https://llm.chutes.ai/*',
        'https://api.abliteration.ai/*',
        'https://api.llamagate.dev/*',
        'https://api.gmi-serving.com/*',
        'https://api.sarvam.ai/*',
        'https://xiaomimimo.com/*',
        'https://nebius.com/*',
        'https://sambanova.ai/*',
        'https://nscale.com/*',
        'https://featherless.ai/*',
        'https://galadriel.com/*',
        'https://recraft.ai/*',
        'https://perplexity.ai/*',
        'https://jina.ai/*',
        'https://raw.githubusercontent.com/*',
        'https://gitlab.com/*',
        'https://tranco-list.eu/*',
        'https://easylist.to/*',
        'https://pgl.yoyo.org/*',
        'https://nsfw.oisd.nl/*',
      ],
      host_permissions: [
        'http://127.0.0.1:27123/*',
        'https://127.0.0.1:27123/*',
        'http://localhost:27123/*',
        'https://localhost:27123/*',
        'http://127.0.0.1:27124/*',
        'https://127.0.0.1:27124/*',
        'http://localhost:27124/*',
        'https://localhost:27124/*',
        'http://127.0.0.1:11434/*',
        'https://127.0.0.1:11434/*',
        'http://localhost:11434/*',
        'https://localhost:11434/*',
        'http://127.0.0.1:1234/*',
        'https://127.0.0.1:1234/*',
        'http://localhost:1234/*',
        'https://localhost:1234/*',
        'https://generativelanguage.googleapis.com/*',
        'https://api.openai.com/*',
        'https://*.openai.com/*',
        'https://api.anthropic.com/*',
        'https://api.groq.com/*',
        'https://mistral.ai/*',
        'https://deepseek.com/*',
        'https://voyageai.com/*',
        'https://volcengine.com/*',
        'https://z.ai/*',
        'https://wandb.ai/*',
        'https://api.ai.sakura.ad.jp/*',
      ],
      content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; connect-src 'self' http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:* https://generativelanguage.googleapis.com https://api.openai.com https://*.openai.com https://api.anthropic.com https://api.groq.com https://mistral.ai https://deepseek.com https://voyageai.com https://volcengine.com https://z.ai https://wandb.ai https://api.ai.sakura.ad.jp https://api-inference.huggingface.co https://api.openrouter.ai https://deepinfra.com https://cerebras.ai https://ai-gateway.helicone.ai https://api.publicai.co https://api.venice.ai https://api.scaleway.ai https://api.synthetic.new https://api.stima.tech https://nano-gpt.com https://api.poe.com https://llm.chutes.ai https://api.abliteration.ai https://api.llamagate.dev https://api.gmi-serving.com https://api.sarvam.ai https://xiaomimimo.com https://nebius.com https://sambanova.ai https://nscale.com https://featherless.ai https://galadriel.com https://recraft.ai https://perplexity.ai https://jina.ai https://raw.githubusercontent.com https://gitlab.com https://tranco-list.eu https://easylist.to https://pgl.yoyo.org https://nsfw.oisd.nl; style-src 'self' 'unsafe-inline'; img-src 'self' chrome-extension: moz-extension: data:; default-src 'none';",
      },
      web_accessible_resources: [
        {
          resources: [
            'content-scripts/content.js',
            'content-extractor.js',
            'chunks/*.js',
            'assets/*.js',
            'icons/icon48.png',
            'data/models-dev-openai-compatible.json',
            'PRIVACY.md',
            'permissions.html',
            'assets/permissions-*.css',
          ],
          matches: ['http://*/*', 'https://*/*'],
        },
      ],
    };

    if (isFirefox) {
      manifest.browser_specific_settings = {
        gecko: {
          id: 'yasumaro@example.com', // User should change this
          strict_min_version: '109.0',
        },
      };
      // Firefox MV3 doesn't support service workers in the same way as Chrome yet.
      // WXT automatically converts the background entry point to 'background.scripts'.
    }

    return manifest;
  },
});

