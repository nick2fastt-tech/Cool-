/**
 * Lightweight request classification.
 *
 * Decides whether a turn is a coding task (so the system prompt adds
 * engineering instructions) or an image request (so the turn is routed to the
 * image provider instead of the text model).
 */

const CODE_PATTERNS: RegExp[] = [
  /\b(write|build|create|make|generate|implement|refactor|optimi[sz]e)\b[^.?!]*\b(code|script|function|class|component|app|website|site|page|api|endpoint|program|bot|game|query|regex)\b/i,
  /\b(debug|fix|why (is|does)|what'?s wrong with)\b[^.?!]*\b(code|script|function|error|exception|bug|stack ?trace|test|build)\b/i,
  /\b(python|javascript|typescript|java|kotlin|swift|rust|golang|go lang|c\+\+|c#|php|ruby|sql|html|css|react|next\.?js|node|lua|roblox|bash|shell|powershell)\b/i,
  /\b(roblox|unity|godot|minecraft (plugin|mod))\b/i,
  /```/,
  /\b(stack ?trace|traceback|segfault|null pointer|compile error|syntax error|type ?error)\b/i,
];

const IMAGE_PATTERNS: RegExp[] = [
  /\b(create|generate|make|draw|paint|render|design|imagine)\b[^.?!]{0,60}\b(an? )?(image|picture|photo|illustration|artwork|logo|poster|wallpaper|drawing|render|painting|concept art)\b/i,
  /\b(image|picture|photo|illustration|artwork) of\b/i,
  /\b(text[- ]to[- ]image)\b/i,
];

// Guard: "write code that generates an image" is a coding task, not an image task.
const IMAGE_NEGATIONS: RegExp[] = [
  /\b(code|script|function|api|library|program|snippet)\b[^.?!]{0,40}\b(image|picture)\b/i,
  /\b(image|picture)\b[^.?!]{0,40}\b(tag|element|component|upload|compression|resizing|format|codec)\b/i,
];

export function isCodingRequest(text: string): boolean {
  return CODE_PATTERNS.some((re) => re.test(text));
}

export function isImageRequest(text: string): boolean {
  if (IMAGE_NEGATIONS.some((re) => re.test(text))) return false;
  return IMAGE_PATTERNS.some((re) => re.test(text));
}

/** Strips the instruction wrapper so the provider receives a clean subject. */
export function extractImagePrompt(text: string): string {
  const cleaned = text
    .replace(/^\s*(please\s+)?(can you\s+)?(create|generate|make|draw|paint|render|design|imagine|show me)\s+/i, "")
    .replace(/^\s*(an?|the)\s+/i, "")
    .replace(/^\s*(image|picture|photo|illustration|artwork|drawing|render|painting)\s+(of|showing|depicting)\s+/i, "")
    .replace(/^\s*(image|picture|photo|illustration|artwork|drawing|render|painting)\s*[:,-]?\s*/i, "")
    .trim();
  return cleaned || text.trim();
}
