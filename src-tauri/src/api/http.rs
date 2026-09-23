//! One process-wide `reqwest::Client`.
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

#[cfg(test)]
mod tests {
    #[test]
    fn client_is_a_single_shared_instance() {
        assert!(std::ptr::eq(super::client(), super::client()));
    }
}
