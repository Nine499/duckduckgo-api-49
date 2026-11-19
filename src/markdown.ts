import type { SearchResponse } from "./types.js";

/** 把搜索结果渲染成人类可读的 Markdown。 */
export function toMarkdown(response: SearchResponse): string {
	const lines: string[] = [];
	lines.push(`# 搜索：${response.query}`);
	lines.push("");

	const filterParts: string[] = [];
	if (response.filters.safe_search !== "off") {
		filterParts.push(`安全搜索=${response.filters.safe_search}`);
	}
	if (response.filters.region !== "none") {
		filterParts.push(`地区=${response.filters.region}`);
	}
	if (response.filters.time_range !== "any") {
		filterParts.push(`时间=${response.filters.time_range}`);
	}
	lines.push(
		`> ${filterParts.length > 0 ? filterParts.join(" · ") : "无过滤条件"}`,
	);
	lines.push("");
	lines.push(`共 ${response.count} 条结果`);
	lines.push("");

	if (response.results.length === 0) {
		lines.push("没有找到结果。");
		return lines.join("\n");
	}

	for (const [index, item] of response.results.entries()) {
		lines.push(`## ${index + 1}. ${item.title}`);
		lines.push("");
		lines.push(`链接：${item.url}`);
		lines.push("");
		lines.push(item.snippet);
		lines.push("");
	}

	return lines.join("\n");
}
