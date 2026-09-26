import { useId } from 'react';

/**
 * Names for a drawing's gradients and clip paths that no other drawing on the
 * page can share: `id('violet')` gives this drawing's own `violet`, to use as
 * `id={id('violet')}` and `fill={`url(#${id('violet')})`}`.
 *
 * On a phone every `<Svg>` is a document of its own, so two drawings can both
 * call a gradient `violet`. On the web they are all one page, and `url(#violet)`
 * finds whichever was drawn first — even one on a screen hidden underneath.
 * That is how the space screen lost its nebulae on the web: it was painting
 * with the start screen's gradient, which the browser does not draw while that
 * screen is hidden. Three ship cards on ship select shared one canopy the same
 * way, so the locked ship's lit up.
 */
export function useSvgIds(): (name: string) => string {
  // React's ids carry punctuation (`:r3:`). Plain characters only, so nothing
  // inside `url(#…)` can trip up a parser.
  const base = useId().replace(/[^A-Za-z0-9_-]/g, '');
  return (name) => `${name}-${base}`;
}
