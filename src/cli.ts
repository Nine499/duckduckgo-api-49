#!/usr/bin/env node
import process from "node:process";
import { CliError } from "./errors.js";
import { toMarkdown } from "./markdown.js";
import { search } from "./search.js";
import type { Filters } from "./types.js";
import { USAGE } from "./usage.js";

const EXIT_OK = 0;
const EXIT_NETWORK = 1;
const EXIT_ARGS = 2;

interface ParsedArgs {
	query: string;
	safe: string;
	region: string;
	time: string;
	markdown: boolean;
}

const SAFE_VALUES = new Set(["off", "moderate", "strict"]);
const TIME_VALUES = new Set(["d", "w", "m", "y"]);

/** 参数遍历器：takeOptionValue 取走紧跟选项后面的值。 */
class ArgStream {
	private index = 0;

	constructor(private readonly argv: string[]) {}

	next(): string | undefined {
		return this.argv[this.index++];
	}

	takeOptionValue(optionName: string): string {
		const value = this.argv[this.index];
		if (value === undefined) {
			throw new CliError(`${optionName} 需要一个值，如 --safe off`);
		}
		this.index++;
		return value;
	}

	*[Symbol.iterator](): Iterator<string | undefined, undefined, undefined> {
		while (this.index < this.argv.length) {
			yield this.argv[this.index++] ?? "";
		}
		return undefined;
	}
}

/** 解析命令行参数。参数错误抛 CliError，由 main 统一处理。 */
function parseArgs(argv: string[]): ParsedArgs {
	const stream = new ArgStream(argv);
	const positional: string[] = [];
	let safe = "off";
	let region = "";
	let time = "";
	let markdown = false;

	for (const arg of stream) {
		if (arg === undefined) {
			break;
		}
		if (arg === "--markdown" || arg === "-m") {
			markdown = true;
		} else if (arg === "--safe") {
			safe = expectChoice(
				stream.takeOptionValue("--safe"),
				"--safe",
				SAFE_VALUES,
			);
		} else if (arg.startsWith("--safe=")) {
			safe = expectChoice(arg.slice("--safe=".length), "--safe", SAFE_VALUES);
		} else if (arg === "--region") {
			region = expectNonEmpty(stream.takeOptionValue("--region"), "--region");
		} else if (arg.startsWith("--region=")) {
			region = expectNonEmpty(arg.slice("--region=".length), "--region");
		} else if (arg === "--time") {
			time = expectChoice(
				stream.takeOptionValue("--time"),
				"--time",
				TIME_VALUES,
			);
		} else if (arg.startsWith("--time=")) {
			time = expectChoice(arg.slice("--time=".length), "--time", TIME_VALUES);
		} else if (arg === "--help" || arg === "-h") {
			process.stdout.write(USAGE);
			process.exit(EXIT_OK);
		} else if (arg.startsWith("--") && arg !== "--") {
			throw new CliError(`未知参数：${arg}`);
		} else {
			positional.push(arg);
		}
	}

	const query = positional.join(" ").trim();
	return { query, safe, region, time, markdown };
}

function expectChoice(
	value: string,
	optionName: string,
	allowed: Set<string>,
): string {
	if (!allowed.has(value)) {
		const list = [...allowed].join(" / ");
		throw new CliError(`${optionName} 的值必须是 ${list}，收到：${value}`);
	}
	return value;
}

function expectNonEmpty(value: string, optionName: string): string {
	if (value === "") {
		throw new CliError(`${optionName} 需要一个地区代码，如 cn-zh、us-en`);
	}
	return value;
}

/** 无位置参数且 stdin 是管道时，读取整个 stdin 作为关键词。 */
async function readStdinQuery(): Promise<string | null> {
	if (process.stdin.isTTY) {
		return null;
	}
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk as Buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8").trim();
	return text === "" ? null : text;
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);

	// 人在终端里直接敲命令名：打印用法，退出码 0。
	if (argv.length === 0 && process.stdin.isTTY) {
		process.stdout.write(USAGE);
		process.exit(EXIT_OK);
	}

	const parsed = (() => {
		try {
			return parseArgs(argv);
		} catch (error) {
			if (error instanceof CliError) {
				outputError(error, EXIT_ARGS);
				process.exit(EXIT_ARGS);
			}
			throw error;
		}
	})();

	let query = parsed.query;
	if (query === "") {
		const stdinQuery = await readStdinQuery();
		if (stdinQuery === null) {
			outputError(
				new CliError(
					"缺少搜索关键词。可以直接跟在命令后面，也可以通过 stdin 管道传入。",
				),
				EXIT_ARGS,
			);
			process.exit(EXIT_ARGS);
		}
		query = stdinQuery;
	}

	const filters: Filters = {
		safe_search: parsed.safe,
		region: parsed.region === "" ? "none" : parsed.region,
		time_range: parsed.time === "" ? "any" : parsed.time,
	};

	const result = await search(query, filters);
	const output = parsed.markdown
		? toMarkdown(result)
		: JSON.stringify(result, null, 2);
	process.stdout.write(`${output}\n`);
}

function outputError(error: CliError, exitCode: number): void {
	const payload = { error: { type: error.type, message: error.message } };
	process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
	process.stderr.write(USAGE);
	process.exitCode = exitCode;
}

main().catch((error: unknown) => {
	if (error instanceof CliError) {
		outputError(error, EXIT_ARGS);
		return;
	}
	const type = "network_error";
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(
		`${JSON.stringify({ error: { type, message } }, null, 2)}\n`,
	);
	process.exitCode = EXIT_NETWORK;
});
