/**
 * First-load seed from the upstream intent config.
 * Copies a stripped config into this package's data dir and never writes the source.
 */
import { randomUUID } from "node:crypto";
import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
	getToolDisplayConfigPath,
	getToolDisplayDataDir,
	getUpstreamIntentConfigPath,
} from "./storage-paths.js";

export interface PreparedToolDisplayMigration {
	copiedLegacyConfig: boolean;
	notices: string[];
}

const waitBuffer = new Int32Array(new SharedArrayBuffer(4));

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function sleepSync(milliseconds: number): void {
	Atomics.wait(waitBuffer, 0, 0, milliseconds);
}

export function withToolDisplayStorageLock<T>(fn: () => T, directory = getToolDisplayDataDir()): T {
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	const lockPath = join(directory, ".storage-migration.lock");
	const deadline = Date.now() + 1_000;
	let descriptor: number | undefined;
	while (descriptor === undefined) {
		try {
			descriptor = openSync(lockPath, "wx", 0o600);
			writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`);
		} catch (error) {
			if (!isRecord(error) || error.code !== "EEXIST") throw error;
			try {
				if (Date.now() - statSync(lockPath).mtimeMs > 30_000) {
					unlinkSync(lockPath);
					continue;
				}
			} catch (statError) {
				if (isRecord(statError) && statError.code === "ENOENT") continue;
				throw statError;
			}
			if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${lockPath}`);
			sleepSync(20);
		}
	}
	try {
		return fn();
	} finally {
		closeSync(descriptor);
		rmSync(lockPath, { force: true });
	}
}

const AGGREGATE_TOOL_CALL_KEYS = ["layout", "expandedTimeline", "showContextGrowth"] as const;
const AGGREGATE_ROOT_KEYS = ["toolCallLayout", "expandedTimeline", "showContextGrowth"] as const;

function stripAggregateSettings(raw: unknown): { value: Record<string, unknown>; dropped: string[] } {
	const source = raw && typeof raw === "object" && !Array.isArray(raw)
		? structuredClone(raw) as Record<string, unknown>
		: {};
	delete source.$schema;
	const dropped: string[] = [];
	for (const key of AGGREGATE_ROOT_KEYS) {
		if (!Object.hasOwn(source, key)) continue;
		delete source[key];
		dropped.push(key);
	}
	const toolCalls = source.toolCalls;
	if (toolCalls && typeof toolCalls === "object" && !Array.isArray(toolCalls)) {
		const section = toolCalls as Record<string, unknown>;
		for (const key of AGGREGATE_TOOL_CALL_KEYS) {
			if (!Object.hasOwn(section, key)) continue;
			delete section[key];
			dropped.push(`toolCalls.${key}`);
		}
		if (Object.keys(section).length === 0) delete source.toolCalls;
	}
	return { value: source, dropped };
}

function seedNotice(source: string, target: string, dropped: readonly string[]): string {
	const droppedText = dropped.length > 0
		? ` Dropped aggregate-only settings: ${dropped.join(", ")}.`
		: "";
	return `Seeded ${target} from ${source}.${droppedText} The original file was not modified.`;
}

function writeSeed(source: string, target: string): string[] {
	const parsed = JSON.parse(readFileSync(source, "utf8")) as unknown;
	const stripped = stripAggregateSettings(parsed);
	const directory = dirname(target);
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	const temporary = join(directory, `.${randomUUID()}.tmp`);
	const body = `${JSON.stringify(stripped.value, null, 2)}\n`;
	try {
		writeFileSync(temporary, body, { encoding: "utf8", mode: 0o600, flag: "wx" });
		renameSync(temporary, target);
	} finally {
		rmSync(temporary, { force: true });
	}
	return [seedNotice(source, target, stripped.dropped)];
}

export function prepareToolDisplayStorageMigration(): PreparedToolDisplayMigration {
	const target = getToolDisplayConfigPath();
	const source = getUpstreamIntentConfigPath();
	const notices: string[] = [];
	if (existsSync(target) || !existsSync(source)) return { copiedLegacyConfig: false, notices };
	try {
		return withToolDisplayStorageLock(() => {
			if (existsSync(target)) return { copiedLegacyConfig: false, notices };
			notices.push(...writeSeed(source, target));
			return { copiedLegacyConfig: true, notices };
		});
	} catch (error) {
		notices.push(`Failed to seed ${target} from ${source}: ${error instanceof Error ? error.message : String(error)}. The original file was not modified.`);
		return { copiedLegacyConfig: false, notices };
	}
}

export function finalizeToolDisplayStorageMigration(prepared: PreparedToolDisplayMigration, _configValid: boolean): string[] {
	return [...prepared.notices];
}
