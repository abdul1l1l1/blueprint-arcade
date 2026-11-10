/* Fixed owner-approved demo illustrations, shared by browser and server. */
(function (root) {
  'use strict';
  const label = 'Illustration — not an in-game screenshot';
  const definitions = [
    ['sunset-manor', 'Sunset Manor', 'abdul_builds', 'bloxburg'],
    ['beach-a-frame', 'Beach A-Frame', 'abdul_builds', 'bloxburg'],
    ['suburban-ranch', 'Suburban Ranch', 'abdul_builds', 'bloxburg'],
    ['tiny-town-rowhome', 'Tiny Town Rowhome', 'simmer99', 'the-sims-4'],
    ['mill-mansion', 'Mill Mansion', 'simmer99', 'the-sims-4'],
    ['the-loft-rebirth', 'The Loft Rebirth', 'flipking', 'house-flipper'],
    ['hoarder-house-rescue', 'Hoarder House Rescue', 'flipking', 'house-flipper'],
    ['old-town-district', 'Old Town District', 'plannerphil', 'cities-skylines-ii'],
    ['fairy-glade-cottage', 'Fairy Glade Cottage', 'cozyqueen', 'tiny-glade'],
    ['castle-overlook', 'Castle Overlook', 'cozyqueen', 'tiny-glade'],
  ];
  const entries = Object.freeze(definitions.map(([slug, title, owner, game]) => Object.freeze({
    slug, title, owner, game,
    path: `/media/demo-illustrations/${slug}-v1.jpg`,
    objectKey: `public/demo-illustrations/${slug}-v1.jpg`,
  })));
  const paths = new Set(entries.map(entry => entry.path));
  const api = Object.freeze({ entries, label, isApprovedUrl: value => paths.has(value) });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BAApprovedImages = api;
})(typeof window === 'object' ? window : {});
