import type { CSSProperties } from 'react';
import type { AssetRef, SectionOf } from '../../contracts/types';
import { longestWordLength } from '../../lib/text';
import { parseVideoLink } from '../../lib/video-links';
import { Ambient } from '../../renderer/fx/Ambient.client';
import { NameShine } from '../../renderer/fx/NameShine.client';
import { fxTheme } from '../../renderer/fx/theme';
import type { PlaceholderArt } from '../../renderer/placeholders';
import { Scene } from '../../renderer/scenes';
import { Icon } from '../../ui/Icon';
import { editPath, type SectionViewProps } from '../shared';
import { GuestGreeting } from '../../renderer/guest.client';
import { HeroEmbed, HeroVideo } from './HeroMedia.client';

/** An upload or a link: resolves to a URL whether or not the file exists. */
const unverified = (ref: AssetRef | null | undefined) => !!ref && !ref.startsWith('template:');

const CLOUDS: [number, number, number, number][] = [
  [8, 12, 38, 9],
  [52, 20, 44, 11],
  [20, 32, 30, 7],
];

/**
 * Sky + drifting clouds + hills — the reference's CSS/SVG stand-in for the hero video — plus, for
 * pale skies, a scrim that keeps the white hero text legible. A scene template draws its scene
 * instead (its centre is kept calm for the names).
 */
function HeroPlaceholder({ art, date }: { art: PlaceholderArt; date: string }) {
  if (art.scene) return <Scene id={art.scene} place="hero" date={date} />;
  const { hills } = art;
  const scrim = art.shade !== null;
  return (
    <>
      {CLOUDS.map(([x, y, w, h], i) => (
        <span
          key={i}
          className="cloud"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${w}%`,
            height: `${h}%`,
            animationDuration: `${34 + i * 9}s`,
            animationDirection: i % 2 ? 'reverse' : 'normal',
          }}
        />
      ))}
      <svg className="hills" viewBox="0 0 400 260" preserveAspectRatio="none">
        <path d="M0 120 C80 70 160 90 230 110 S360 80 400 95 V260 H0Z" fill={hills[0]} opacity=".75" />
        <path d="M0 170 C100 130 200 150 280 160 S370 140 400 150 V260 H0Z" fill={hills[1]} />
        {Array.from({ length: 14 }, (_, i) => (
          <path
            key={i}
            d={`M${i * 30} 260 L${150 + i * 8} 168`}
            stroke={hills[2]}
            strokeWidth="2"
            opacity=".55"
          />
        ))}
        <path d="M0 215 C120 190 260 205 400 195 V260 H0Z" fill={hills[3]} />
      </svg>
      {scrim ? <span className="scrim" /> : null}
    </>
  );
}

export function HeroView({ section, ctx }: SectionViewProps<SectionOf<'hero'>>) {
  const d = section.data;
  const { doc } = ctx;
  const path = editPath(ctx, section);
  const src = ctx.asset(d.media.src);
  const poster = ctx.asset(d.media.poster);
  const focal = `${d.media.focalPoint.x * 100}% ${d.media.focalPoint.y * 100}%`;

  // the host's "video sound" option: this video's sound instead of the track, on the live page
  const sound = ctx.mode === 'live' && doc.music.enabled && doc.music.videoSound;
  const link = d.media.kind === 'video' ? parseVideoLink(d.media.src) : null;

  let media = null;
  if (link) {
    media = (
      <HeroEmbed
        link={link}
        poster={poster}
        sound={sound}
        captions={d.captions}
        start={link.start}
        calm={ctx.mode === 'live'}
      />
    );
  } else if (d.media.kind === 'video' && src) {
    media = (
      <HeroVideo
        src={src}
        poster={poster}
        focal={focal}
        sound={sound ? doc.music.volume : null}
        calm={ctx.mode === 'live'}
      />
    );
  } else if (d.media.kind === 'video' && poster) {
    media = <img src={poster} alt="" style={{ objectPosition: focal }} fetchPriority="high" />;
  } else if (d.media.kind === 'image' && src) {
    media = <img src={src} alt="" style={{ objectPosition: focal }} fetchPriority="high" />;
  }
  // Template media only resolves once the file is in the bucket (media-manifest.json), but an uploaded
  // or linked file can be missing (the kit fixtures point at uploads that don't exist; a host may
  // delete one). Draw the placeholder art under those: a file that fails to load leaves the element
  // transparent, so the art and its scrim show through instead of a bare sky (§5 missing media).
  const placeholder = !media || unverified(d.media.src) || unverified(d.media.poster);

  const custom = d.title.mode === 'custom';
  const joiner = ctx.text(doc.hosts.joiner) || '&';
  const fit = (text: string) => ({ '--chars': longestWordLength(text, ctx.locale) }) as CSSProperties;
  const primary = ctx.text(doc.hosts.primary);
  const secondary = ctx.text(doc.hosts.secondary);
  const customTitle = d.title.mode === 'custom' ? ctx.text(d.title.text) : '';
  // the template's particles (renderer/fx) — drawn in the browser only, after the cover opens
  const fx = fxTheme(ctx.template, doc);
  return (
    <header className="hero" data-edit-path={path}>
      <div className="hero-media" aria-hidden="true">
        {placeholder ? <HeroPlaceholder art={ctx.art} date={doc.event.date} /> : null}
        {media}
      </div>
      <div className="hero-overlay" style={{ '--ov': d.overlayOpacity } as CSSProperties} />
      <Ambient kind={fx.ambient} colors={fx.ambientColors} seed={`${ctx.template.id}:${doc.share.slug}`} />
      <div className="hero-inner hero-enter">
        {/* one child for the entrance's stagger: the guest's greeting (personal links) + the eyebrow */}
        <div className="hero-lead">
          {d.greeting ? (
            <GuestGreeting
              text={ctx.text(d.greeting)}
              sample={ctx.mode === 'editor' ? ctx.t('guest.sample') : undefined}
              editPath={path && `${path}.data.greeting`}
            />
          ) : null}
          {d.eyebrow ? (
            <p className="eyebrow" data-edit-path={path && `${path}.data.eyebrow`}>
              {ctx.text(d.eyebrow)}
            </p>
          ) : null}
        </div>
        <h1
          className={custom ? 'names custom' : 'names'}
          data-edit-path={path && `${path}.data.title`}
          style={{ '--shine': fx.shine } as CSSProperties}
        >
          {custom ? (
            <span className="n" style={fit(customTitle)}>
              {customTitle}
              <NameShine text={customTitle} />
            </span>
          ) : (
            <>
              <span className="n" style={fit(primary)}>
                <bdi>{primary}</bdi>
                <NameShine text={primary} />
              </span>
              {doc.hosts.secondary ? (
                <>
                  <span className="j">{joiner}</span>
                  <span className="n" style={fit(secondary)}>
                    <bdi>{secondary}</bdi>
                    <NameShine text={secondary} />
                  </span>
                </>
              ) : null}
            </>
          )}
        </h1>
        <div className="rule" />
        <p className="hero-date">
          {d.showDate ? (
            <>
              {ctx.eventDateLong}
              {ctx.hebrewDate ? <span className="hdate">{ctx.hebrewDate}</span> : null}
            </>
          ) : null}
        </p>
        {d.locationLine ? (
          <p className="hero-loc" data-edit-path={path && `${path}.data.locationLine`}>
            {ctx.text(d.locationLine)}
          </p>
        ) : (
          <span />
        )}
      </div>
      <span className="cue" aria-hidden="true">
        <Icon name="chevron-down" size={28} strokeWidth={1.2} />
      </span>
    </header>
  );
}
