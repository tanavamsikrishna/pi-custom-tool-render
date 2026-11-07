export interface PromptMetadata {
	promptSnippet?: string;
	promptGuidelines?: string[];
}

const MAX_PROMPT_SNIPPET_LENGTH = 120;

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toRecord(value: unknown): Record<string, unknown> {
	if (!isRecord(value)) {
		return {};
	}

	return value;
}

export function getTextField(value: unknown, field: string): string | undefined {
	const record = toRecord(value);
	const raw = record[field];
	return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
}

function normalizeInlineText(value: string): string {
	return value.trim().replace(/\s+/g, " ");
}

function trimPromptSnippet(value: string): string {
	if (value.length <= MAX_PROMPT_SNIPPET_LENGTH) {
		return value;
	}

	const truncated = value.slice(0, MAX_PROMPT_SNIPPET_LENGTH).trimEnd();
	return `${truncated.replace(/[\s.,;:!?-]+$/u, "")}…`;
}

export function buildPromptSnippetFromDescription(description: string | undefined, fallback: string): string {
	const normalizedDescription = normalizeInlineText(description || "");
	const normalizedFallback = normalizeInlineText(fallback);
	const base = normalizedDescription || normalizedFallback;
	const firstSentence = base.split(/(?<=[.!?])\s+/u, 1)[0] ?? base;
	const withoutSentencePunctuation = firstSentence.replace(/[.!?]+$/u, "").trim();
	return trimPromptSnippet(withoutSentencePunctuation || base);
}

export function extractPromptMetadata(tool: unknown): PromptMetadata {
	const source = toRecord(tool);
	const promptSnippet =
		typeof source.promptSnippet === "string" && source.promptSnippet.trim().length > 0
			? source.promptSnippet
			: undefined;
	const promptGuidelines = Array.isArray(source.promptGuidelines)
		? source.promptGuidelines.filter(
				(guideline): guideline is string =>
					typeof guideline === "string" && guideline.trim().length > 0,
			)
		: undefined;

	return {
		promptSnippet,
		promptGuidelines:
			promptGuidelines && promptGuidelines.length > 0
				? [...promptGuidelines]
				: undefined,
	};
}
