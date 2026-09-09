/**
 * Shared reaction definitions.
 * Each entry maps an emoji character to its custom image file (in /emojis/).
 * Both the image AND the native emoji are shown together in the UI.
 */
export const REACTIONS = [
  { emoji: '❤️',  image: '/emojis/heart.png',    label: 'Heart' },
  { emoji: '😂',  image: '/emojis/laugh.png',    label: 'Laugh' },
  { emoji: '🍿',  image: '/emojis/popcorn.png',  label: 'Popcorn' },
  { emoji: '😱',  image: '/emojis/surprise.png', label: 'Surprise' },
  { emoji: '🔥',  image: '/emojis/fire.png',     label: 'Fire' },
  { emoji: '👏',  image: '/emojis/clap.png',     label: 'Clap' },
  { emoji: '😭',  image: '/emojis/cry.png',      label: 'Cry' },
  { emoji: '✨',  image: '/emojis/sparkle.png',  label: 'Sparkle' },
];

/** Quick lookup: emoji char → image URL */
export const EMOJI_TO_IMAGE = Object.fromEntries(
  REACTIONS.map(({ emoji, image }) => [emoji, image])
);
