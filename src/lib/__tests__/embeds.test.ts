import { describe, expect, it } from 'vitest';
import { canEmbed, isShortMapsLink, soleUrl, toEmbed } from '../embeds';

const src = (url: string) => toEmbed(url)?.src;

describe('toEmbed', () => {
  it('YouTube: watch, short links, shorts and start times', () => {
    expect(src('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(src('https://youtu.be/dQw4w9WgXcQ?t=1m30s')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90');
    expect(src('https://m.youtube.com/shorts/abcDEF12345')).toBe('https://www.youtube-nocookie.com/embed/abcDEF12345');
    expect(toEmbed('https://www.youtube.com/@somechannel')).toBeNull();
  });

  it('Vimeo, including private hashes', () => {
    expect(src('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
    expect(src('https://vimeo.com/76979871/abc123')).toBe('https://player.vimeo.com/video/76979871?h=abc123');
  });

  it('Google Maps: places, coordinates, searches and directions', () => {
    const place = src('https://www.google.com/maps/place/India+Gate/@28.6129,77.2295,17z/data=!3m1');
    expect(place).toContain('q=India+Gate');
    expect(place).toContain('z=17');
    expect(src('https://www.google.com/maps/@12.97,77.59,14z')).toContain('q=12.97%2C77.59');
    expect(src('https://www.google.co.in/maps/search/coffee+near+me')).toContain('q=coffee+near+me');
    const dir = src('https://www.google.com/maps/dir/Bangalore/Mysore/');
    expect(dir).toContain('saddr=Bangalore');
    expect(dir).toContain('daddr=Mysore');
    expect(toEmbed('https://www.google.com/search?q=maps')).toBeNull();
  });

  it('flags short Maps links for the server to resolve', () => {
    expect(isShortMapsLink('https://maps.app.goo.gl/AbCdEf')).toBe(true);
    expect(toEmbed('https://maps.app.goo.gl/AbCdEf')).toBeNull();
    expect(canEmbed('https://maps.app.goo.gl/AbCdEf')).toBe(true);
  });

  it('Spotify and Apple Music players are sized by kind', () => {
    expect(toEmbed('https://open.spotify.com/intl-en/track/4cOdK2wGLETKBW3PvgPWqT?si=x')).toEqual({
      provider: 'Spotify',
      src: 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT',
      height: 152,
    });
    expect(toEmbed('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')?.height).toBe(352);
    expect(toEmbed('https://music.apple.com/in/album/abbey-road/1441164426?i=1441164430')).toMatchObject({
      src: 'https://embed.music.apple.com/in/album/abbey-road/1441164426?i=1441164430',
      height: 175,
    });
  });

  it('Figma, Loom and Google Docs', () => {
    expect(src('https://www.figma.com/design/AbC123/My-File?node-id=1-2')).toBe(
      'https://www.figma.com/embed?embed_host=folio&url=https%3A%2F%2Fwww.figma.com%2Fdesign%2FAbC123%2FMy-File%3Fnode-id%3D1-2',
    );
    expect(src('https://www.loom.com/share/0123456789abcdef0123456789abcdef')).toBe(
      'https://www.loom.com/embed/0123456789abcdef0123456789abcdef',
    );
    expect(src('https://docs.google.com/document/d/1AbC-dEf/edit?usp=sharing')).toBe('https://docs.google.com/document/d/1AbC-dEf/preview');
    expect(src('https://docs.google.com/presentation/d/1XyZ/edit')).toBe('https://docs.google.com/presentation/d/1XyZ/embed');
  });

  it('frames nothing else', () => {
    expect(toEmbed('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(toEmbed('javascript:alert(1)')).toBeNull();
    expect(toEmbed('not a url')).toBeNull();
  });
});

describe('soleUrl', () => {
  it('accepts one link and nothing else', () => {
    expect(soleUrl('  https://paulgraham.com/greatwork.html \n')).toBe('https://paulgraham.com/greatwork.html');
    expect(soleUrl('read https://paulgraham.com')).toBeNull();
    expect(soleUrl('ftp://x.y')).toBeNull();
  });
});
