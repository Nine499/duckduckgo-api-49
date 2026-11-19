export interface SearchResultItem {
	title: string;
	url: string;
	snippet: string;
}

export interface Filters {
	/** off / moderate / strict */
	safe_search: string;
	/** DDG 地区代码（如 cn-zh、us-en），none 表示不限 */
	region: string;
	/** d / w / m / y，any 表示不限 */
	time_range: string;
}

export interface SearchResponse {
	query: string;
	filters: Filters;
	count: number;
	results: SearchResultItem[];
}
