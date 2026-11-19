/** 参数错误：退出码 2。 */
export class CliError extends Error {
	readonly type = "invalid_args";
}

/** 网络请求失败：退出码 1。 */
export class NetworkError extends Error {
	readonly type = "network_error";
}

/** 被 DuckDuckGo 限流：退出码 1。 */
export class RateLimitError extends Error {
	readonly type = "rate_limited";
}
