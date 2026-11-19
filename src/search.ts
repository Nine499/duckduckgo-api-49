import { load } from "cheerio";
import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";
import { NetworkError, RateLimitError } from "./errors.js";
import type { Filters, SearchResponse, SearchResultItem } from "./types.js";

const SEARCH_URL = "https://html.duckduckgo.com/html/";
const USER_AGENT =
	"Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0";

/** 安全搜索值 → DDG kp 参数。 */
const SAFE_TO_KP: Record<string, string> = {
	off: "-2",
	moderate: "-1",
	strict: "1",
};

/** 限流重试：最多重试 1 次，退避 3 秒。 */
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 3000;

/** 复用一个代理感知的 fetch。EnvHttpProxyAgent 读 HTTPS_PROXY/HTTP_PROXY/NO_PROXY。 */
const proxyDispatcher = new EnvHttpProxyAgent();

interface FetchOutcome {
	status: number;
	body: string;
}

async function fetchOnce(
	query: string,
	filters: Filters,
): Promise<FetchOutcome> {
	const params = new URLSearchParams({ q: query });
	if (filters.safe_search !== "off") {
		params.set("kp", SAFE_TO_KP[filters.safe_search] ?? "-2");
	}
	if (filters.region !== "none") {
		params.set("kl", filters.region);
	}
	if (filters.time_range !== "any") {
		params.set("df", filters.time_range);
	}

	// 必须用 GET：DDG 对非浏览器指纹的 POST 表单请求返回 202 反爬页。
	// 必须带 Accept 头：无 Accept 的请求同样触发 202 反爬页（已实测）。
	const response = await undiciFetch(`${SEARCH_URL}?${params.toString()}`, {
		method: "GET",
		headers: {
			"User-Agent": USER_AGENT,
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.5",
		},
		dispatcher: proxyDispatcher,
	});
	const body = await response.text();
	return { status: response.status, body };
}

/** 搜索并解析结果。网络失败抛 NetworkError，限流抛 RateLimitError。 */
export async function search(
	query: string,
	filters: Filters,
): Promise<SearchResponse> {
	let lastError: RateLimitError | null = null;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
		}

		let outcome: FetchOutcome;
		try {
			outcome = await fetchOnce(query, filters);
		} catch (error) {
			const message =
				error instanceof Error
					? `${error.message}${error.cause instanceof Error ? `: ${error.cause.message}` : ""}`
					: String(error);
			throw new NetworkError(`请求 DuckDuckGo 失败：${message}`);
		}

		if (outcome.status === 403 || outcome.status === 429) {
			lastError = new RateLimitError(
				`被 DuckDuckGo 限流（HTTP ${outcome.status}），重试后仍失败`,
			);
			continue;
		}
		if (outcome.status === 202) {
			// 实测：含搜索语法（双引号精确匹配、site: 域名限定）的关键词
			// 被 DDG 边缘层拦截，恒定返回 202，退避重试无效。
			throw new NetworkError(
				'DuckDuckGo 拒绝了该关键词（HTTP 202）。已知触发条件：关键词含双引号精确匹配（"..."）或 site:域名 等搜索语法。请去掉这些语法后重试。',
			);
		}
		if (outcome.status !== 200) {
			throw new NetworkError(
				`DuckDuckGo 返回异常状态码：HTTP ${outcome.status}`,
			);
		}

		const results = parseResults(outcome.body);
		if (results === null) {
			// 200 但页面结构不是结果页：DDG 的限流表现有时是 200 + 异常页。
			lastError = new RateLimitError(
				"DuckDuckGo 返回了异常页面（疑似限流），重试后仍失败",
			);
			continue;
		}

		return {
			query,
			filters,
			count: results.length,
			results,
		};
	}

	throw lastError ?? new NetworkError("搜索失败");
}

/** 解析结果页。返回条目数组；页面结构异常时返回 null（调用方按限流处理）。 */
function parseResults(html: string): SearchResultItem[] | null {
	const $ = load(html);
	const items: SearchResultItem[] = [];

	$(".result").each((_index, element) => {
		const node = $(element);
		const titleNode = node.find("a.result__a");
		if (titleNode.length === 0) {
			return;
		}
		const title = titleNode.text().trim();
		const rawUrl = titleNode.attr("href") ?? "";
		const snippet = node.find(".result__snippet").text().trim();
		const url = extractRealUrl(rawUrl);
		if (title === "" || url === "") {
			return;
		}
		items.push({ title, url, snippet });
	});

	// 完全没有结果条目 = 页面异常（正常页面即使零匹配也会给宽松结果）。
	// 但真正零结果的情况也存在，此时返回空数组而不是 null。
	if (items.length === 0) {
		const hasResultShell = $(".results").length > 0;
		return hasResultShell ? [] : null;
	}
	return items;
}

/** 从 DDG 重定向链接解出真实 URL；已是直链则原样返回。 */
function extractRealUrl(href: string): string {
	if (!href.startsWith("//duckduckgo.com/l/")) {
		return href.startsWith("//") ? `https:${href}` : href;
	}
	try {
		const redirectUrl = new URL(`https:${href}`);
		const uddg = redirectUrl.searchParams.get("uddg");
		return uddg ?? "";
	} catch {
		return "";
	}
}
