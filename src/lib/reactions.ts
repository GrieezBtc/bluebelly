/** Reactions. Comments use a fixed set of six; messages accept any emoji from the person's keyboard. */

export const COMMENT_REACTIONS = [
  { id: "like", emoji: "👍", label: "Like" },
  { id: "love", emoji: "❤️", label: "Love" },
  { id: "haha", emoji: "😂", label: "Haha" },
  { id: "wow", emoji: "😲", label: "Wow" },
  { id: "sad", emoji: "😢", label: "Sad" },
  { id: "angry", emoji: "😡", label: "Angry" },
] as const;

export type CommentReaction = (typeof COMMENT_REACTIONS)[number]["id"];

export function isCommentReaction(value: unknown): value is CommentReaction {
  return typeof value === "string" && COMMENT_REACTIONS.some((item) => item.id === value);
}

export function commentReactionInfo(id: CommentReaction) {
  return COMMENT_REACTIONS.find((item) => item.id === id) ?? COMMENT_REACTIONS[0];
}

/** One-tap choices shown first in a message's reaction bar; the "+" button opens the full keyboard. */
export const QUICK_MESSAGE_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

// A single emoji: pictographs (with skin tone / ZWJ / variation selectors), flags, or keycaps.
const EMOJI_AT_START =
  /^(?:\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic})*|\p{Regional_Indicator}{2}|[#*0-9]️?⃣)/u;

/** Returns the first emoji in the text, or null when there is none. */
export function normalizeEmoji(input: string): string | null {
  const text = input.trim();
  if (!text || text.length > 64) return null;
  const match = EMOJI_AT_START.exec(text);
  return match ? match[0] : null;
}
