//! Pure helpers for the debug-logging setup (A8). Kept side-effect-free and
//! unit-tested directly; `lib.rs` wires them into the `tauri-plugin-log`
//! builder, which is not itself unit-testable.
//!
//! Secret handling lives in `api::http`: `request_error`/`fetch_json` strip
//! the request URL (which carries API keys) from every provider error before
//! it is logged or returned to the UI.

use log::LevelFilter;
use tauri_plugin_log::WEBVIEW_TARGET;

/// Default level when `TAURI_APP_LOG` is unset: `Debug` in dev builds so
/// request lines and `console.debug` show up, `Info` in release builds.
pub fn default_level(dev_build: bool) -> LevelFilter {
    if dev_build {
        LevelFilter::Debug
    } else {
        LevelFilter::Info
    }
}

/// Maps the `TAURI_APP_LOG` env var to a `LevelFilter`.
/// Unset, empty, or unrecognised values fall back to `default`, so a typo
/// never silently turns logging all the way up (`Trace`) or off (`Off`).
pub fn level_from_env(value: Option<&str>, default: LevelFilter) -> LevelFilter {
    match value.map(str::trim).map(str::to_ascii_lowercase).as_deref() {
        Some("trace") => LevelFilter::Trace,
        Some("debug") => LevelFilter::Debug,
        Some("info") => LevelFilter::Info,
        Some("warn") => LevelFilter::Warn,
        Some("error") => LevelFilter::Error,
        Some("off") => LevelFilter::Off,
        _ => default,
    }
}

/// Third-party crates whose debug output would drown ours (connection pool,
/// TLS handshakes, window events). Capped at `Info` unless the user asks for
/// `trace`, which means "show me everything".
pub const NOISY_CRATES: &[&str] = &["hyper", "hyper_util", "reqwest", "rustls", "tao", "wry"];

pub fn noisy_crate_level(level: LevelFilter) -> LevelFilter {
    if level == LevelFilter::Trace {
        LevelFilter::Trace
    } else {
        level.min(LevelFilter::Info)
    }
}

/// True for records that originate in Rust, false for records the frontend
/// sent through the plugin (`target` = `webview` or `webview::<location>`).
/// The Webview target uses this so frontend logs are not echoed back into the
/// devtools console they came from.
pub fn is_rust_record(target: &str) -> bool {
    !target.starts_with(WEBVIEW_TARGET)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_level_is_debug_in_dev_and_info_in_release() {
        assert_eq!(default_level(true), LevelFilter::Debug);
        assert_eq!(default_level(false), LevelFilter::Info);
    }

    #[test]
    fn level_from_env_uses_the_default_when_unset() {
        assert_eq!(level_from_env(None, LevelFilter::Debug), LevelFilter::Debug);
        assert_eq!(level_from_env(None, LevelFilter::Info), LevelFilter::Info);
    }

    #[test]
    fn level_from_env_uses_the_default_on_empty_or_garbage() {
        assert_eq!(
            level_from_env(Some(""), LevelFilter::Info),
            LevelFilter::Info
        );
        assert_eq!(
            level_from_env(Some("nonsense"), LevelFilter::Debug),
            LevelFilter::Debug
        );
    }

    #[test]
    fn level_from_env_parses_every_known_level_case_insensitively() {
        let d = LevelFilter::Info;
        assert_eq!(level_from_env(Some("trace"), d), LevelFilter::Trace);
        assert_eq!(level_from_env(Some("DEBUG"), d), LevelFilter::Debug);
        assert_eq!(level_from_env(Some(" Info "), d), LevelFilter::Info);
        assert_eq!(level_from_env(Some("WARN"), d), LevelFilter::Warn);
        assert_eq!(level_from_env(Some("error"), d), LevelFilter::Error);
        assert_eq!(level_from_env(Some("Off"), d), LevelFilter::Off);
    }

    #[test]
    fn noisy_crates_are_capped_at_info_unless_trace() {
        assert_eq!(noisy_crate_level(LevelFilter::Debug), LevelFilter::Info);
        assert_eq!(noisy_crate_level(LevelFilter::Info), LevelFilter::Info);
        assert_eq!(noisy_crate_level(LevelFilter::Warn), LevelFilter::Warn);
        assert_eq!(noisy_crate_level(LevelFilter::Trace), LevelFilter::Trace);
    }

    #[test]
    fn is_rust_record_excludes_frontend_records() {
        assert!(is_rust_record("tauri_app_lib::api::http"));
        assert!(!is_rust_record("webview"));
        assert!(!is_rust_record("webview::src/lib/logging/console.ts:40"));
    }
}
