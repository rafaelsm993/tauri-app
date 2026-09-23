//! One process-wide `reqwest::Client`, plus the shared request path every
//! provider command uses (`fetch_json`) and its error mapper.
//!
//! `reqwest::Client` holds a connection pool and TLS session cache and is
//! cheap to share (`Arc` inside). Building one per request, as the provider
//! modules used to, throws both away on every call.
use reqwest::{Client, RequestBuilder};
use serde_json::Value;
use std::sync::LazyLock;
use std::time::Instant;

static CLIENT: LazyLock<Client> = LazyLock::new(|| {
    Client::builder()
        .user_agent(concat!("tauri-app/", env!("CARGO_PKG_VERSION")))
        .build()
        .unwrap_or_else(|_| Client::new())
});

/// Shared HTTP client for every provider command.
pub fn client() -> &'static Client {
    &CLIENT
}

/// Turns a `reqwest::Error` into the message returned to the UI, and logs it.
///
/// `reqwest::Error`'s `Display` appends `for url (...)`, and our request URLs
/// carry API keys as query params (`api_key=` / `key=`). Stripping the URL at
/// the source means the key can reach neither the log nor the UI, regardless
/// of which provider or call site produced the error.
pub fn request_error(provider: &str, e: reqwest::Error) -> String {
    let msg = e.without_url().to_string();
    log::error!("[{provider}] {msg}");
    msg
}

/// Sends `req`, checks the HTTP status, parses JSON, and logs one summary line:
/// `[provider] op → 200 in 143ms, 20 results` (info) or
/// `[provider] op → HTTP 401 in 88ms: Invalid API key` (warn).
///
/// Non-2xx responses (bad key, rate limit, not found) become `Err` with the
/// provider's own message, so they are never passed to the UI as data. Only
/// the summary is logged, never the body or the URL (which carries keys).
pub async fn fetch_json(provider: &str, op: &str, req: RequestBuilder) -> Result<Value, String> {
    let started = Instant::now();
    let resp = req.send().await.map_err(|e| request_error(provider, e))?;
    let status = resp.status();
    let retry_after = resp
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let text = resp.text().await.map_err(|e| request_error(provider, e))?;
    let ms = started.elapsed().as_millis();
    let body: Option<Value> = serde_json::from_str(&text).ok();

    if !status.is_success() {
        let msg = body
            .as_ref()
            .and_then(provider_error_message)
            .unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
        let retry = retry_after
            .map(|s| format!(" (retry after {s}s)"))
            .unwrap_or_default();
        log::warn!(
            "[{provider}] {op} → HTTP {} in {ms}ms: {msg}{retry}",
            status.as_u16()
        );
        return Err(msg);
    }

    let Some(body) = body else {
        let msg = format!("{provider}: response was not valid JSON");
        log::error!("[{provider}] {op} → {} in {ms}ms: {msg}", status.as_u16());
        return Err(msg);
    };
    log::info!(
        "[{provider}] {op} → {} in {ms}ms, {}",
        status.as_u16(),
        describe_count(result_count(&body))
    );
    Ok(body)
}

/// Number of list items in a provider response, when it is a list.
/// TMDB/RAWG/iTunes use `results`; AniList uses `data.Page.media`.
fn result_count(body: &Value) -> Option<usize> {
    body.get("results")
        .or_else(|| body.pointer("/data/Page/media"))
        .and_then(Value::as_array)
        .map(Vec::len)
}

fn describe_count(count: Option<usize>) -> String {
    match count {
        Some(1) => "1 result".to_string(),
        Some(n) => format!("{n} results"),
        None => "1 item".to_string(),
    }
}

/// The provider's own error text from an error body, if it has one:
/// TMDB `status_message`, RAWG `detail`/`error`, AniList `errors[].message`,
/// iTunes `errorMessage`.
fn provider_error_message(body: &Value) -> Option<String> {
    let direct = ["status_message", "detail", "errorMessage", "error"]
        .iter()
        .find_map(|k| body.get(*k).and_then(Value::as_str));
    if let Some(msg) = direct {
        return Some(msg.to_string());
    }
    let joined = body
        .get("errors")?
        .as_array()?
        .iter()
        .filter_map(|e| e.get("message").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("; ");
    (!joined.is_empty()).then_some(joined)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    const SECRET: &str = "sup3r-s3cret-key";

    // Port 1 on loopback refuses immediately: a real reqwest::Error whose
    // Display includes the URL, with no network access needed.
    async fn failing_request() -> reqwest::Error {
        client()
            .get(format!("http://127.0.0.1:1/x?api_key={SECRET}"))
            .send()
            .await
            .expect_err("port 1 must refuse the connection")
    }

    /// One-shot local HTTP server returning `status_line` + `body`.
    /// Returns a URL that carries a fake key, like the real providers.
    async fn serve_once(status_line: &'static str, body: &'static str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut sock, _) = listener.accept().await.unwrap();
            let mut buf = [0u8; 2048];
            let _ = sock.read(&mut buf).await;
            let resp = format!(
                "HTTP/1.1 {status_line}\r\nContent-Type: application/json\r\n\
                 Retry-After: 30\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            sock.write_all(resp.as_bytes()).await.unwrap();
        });
        format!("http://{addr}/x?api_key={SECRET}")
    }

    #[test]
    fn client_is_a_single_shared_instance() {
        assert!(std::ptr::eq(client(), client()));
    }

    #[tokio::test]
    async fn raw_reqwest_error_does_leak_the_key() {
        // Guards the premise: if reqwest ever stops printing the URL, this
        // fails and the helper below can be revisited.
        assert!(failing_request().await.to_string().contains(SECRET));
    }

    #[tokio::test]
    async fn request_error_strips_the_url_and_key() {
        let msg = request_error("test", failing_request().await);
        assert!(!msg.contains(SECRET), "key leaked: {msg}");
        assert!(!msg.contains("127.0.0.1"), "url leaked: {msg}");
        assert!(!msg.is_empty());
    }

    #[tokio::test]
    async fn fetch_json_returns_the_body_on_success() {
        let url = serve_once("200 OK", r#"{"results":[1,2,3]}"#).await;
        let body = fetch_json("test", "op", client().get(url)).await.unwrap();
        assert_eq!(body["results"].as_array().unwrap().len(), 3);
    }

    #[tokio::test]
    async fn fetch_json_turns_http_errors_into_err_with_provider_message() {
        let url = serve_once(
            "401 Unauthorized",
            r#"{"status_message":"Invalid API key: You must be granted a valid key."}"#,
        )
        .await;
        let err = fetch_json("test", "op", client().get(url))
            .await
            .unwrap_err();
        assert!(err.contains("Invalid API key"), "got: {err}");
        assert!(!err.contains(SECRET), "key leaked: {err}");
    }

    #[tokio::test]
    async fn fetch_json_falls_back_to_status_code_when_body_is_not_json() {
        let url = serve_once("429 Too Many Requests", "slow down").await;
        let err = fetch_json("test", "op", client().get(url))
            .await
            .unwrap_err();
        assert_eq!(err, "HTTP 429");
    }

    #[test]
    fn result_count_reads_rest_and_graphql_shapes() {
        assert_eq!(result_count(&json!({"results": [1, 2]})), Some(2));
        assert_eq!(
            result_count(&json!({"data": {"Page": {"media": [1, 2, 3]}}})),
            Some(3)
        );
        assert_eq!(result_count(&json!({"id": 7, "title": "x"})), None);
    }

    #[test]
    fn describe_count_is_readable() {
        assert_eq!(describe_count(Some(0)), "0 results");
        assert_eq!(describe_count(Some(1)), "1 result");
        assert_eq!(describe_count(Some(20)), "20 results");
        assert_eq!(describe_count(None), "1 item");
    }

    #[test]
    fn provider_error_message_covers_every_provider_shape() {
        assert_eq!(
            provider_error_message(&json!({"status_message": "bad key"})).as_deref(),
            Some("bad key")
        );
        assert_eq!(
            provider_error_message(&json!({"detail": "Not found."})).as_deref(),
            Some("Not found.")
        );
        assert_eq!(
            provider_error_message(&json!({"errors": [{"message": "a"}, {"message": "b"}]}))
                .as_deref(),
            Some("a; b")
        );
        assert_eq!(
            provider_error_message(&json!({"errorMessage": "Invalid value"})).as_deref(),
            Some("Invalid value")
        );
        assert_eq!(provider_error_message(&json!({"results": []})), None);
    }
}
