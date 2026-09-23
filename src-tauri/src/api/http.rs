//! One process-wide `reqwest::Client`, plus the shared error mapper every
//! provider command uses.
//!
//! `reqwest::Client` holds a connection pool and TLS session cache and is
//! cheap to share (`Arc` inside). Building one per request, as the provider
//! modules used to, throws both away on every call.
use reqwest::Client;
use std::sync::LazyLock;

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
