import { describe, expect, it } from 'vitest';
import { isPrivateHost, parseMeta } from './unfurl.ts';

describe('parseMeta', () => {
  it('prefers Open Graph, resolves relative URLs and decodes entities', () => {
    const html = `<!doctype html><html><head>
      <title>Fallback title</title>
      <meta content="How to Do Great Work" property="og:title">
      <meta name="description" content="Plain description">
      <meta property="og:description" content="If you collected lists of techniques &amp; tips&#8230;">
      <meta property="og:image" content="/img/cover.jpg">
      <meta property="og:site_name" content='Paul Graham'>
      <link rel="icon" href="/favicon.png">
      <link rel="apple-touch-icon" href="https://cdn.example.com/touch.png">
    </head><body><meta property="og:title" content="Not in head"></body></html>`;
    expect(parseMeta(html, 'https://paulgraham.com/greatwork.html')).toEqual({
      title: 'How to Do Great Work',
      description: 'If you collected lists of techniques & tips…',
      image: 'https://paulgraham.com/img/cover.jpg',
      site: 'Paul Graham',
      icon: 'https://cdn.example.com/touch.png',
    });
  });

  it('falls back to <title>, meta description and /favicon.ico', () => {
    const html = '<html><head><title> A  plain page </title><meta name="description" content="Nothing fancy"></head></html>';
    expect(parseMeta(html, 'https://example.com/a/b')).toEqual({
      title: 'A plain page',
      description: 'Nothing fancy',
      image: null,
      site: null,
      icon: 'https://example.com/favicon.ico',
    });
  });

  it('ignores non-http image URLs', () => {
    const html = '<head><meta property="og:image" content="javascript:alert(1)"></head>';
    expect(parseMeta(html, 'https://example.com').image).toBeNull();
  });
});

describe('isPrivateHost', () => {
  it('blocks loopback, private and link-local addresses', () => {
    for (const h of ['localhost', '127.0.0.1', '10.0.0.5', '172.20.1.1', '192.168.1.1', '169.254.169.254', '[::1]', 'fd00::1', 'printer.local', '0.0.0.0']) {
      expect(isPrivateHost(h), h).toBe(true);
    }
  });
  it('allows public hosts', () => {
    for (const h of ['paulgraham.com', '8.8.8.8', '172.32.0.1', 'maps.app.goo.gl']) {
      expect(isPrivateHost(h), h).toBe(false);
    }
  });
});
