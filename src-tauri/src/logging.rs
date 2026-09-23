//! Pure helpers for the debug-logging setup (A8). Kept side-effect-free and
//! unit-tested directly; `lib.rs` wires them into the `tauri-plugin-log`
//! builder, which is not itself unit-testable.
//!
//! Secret handling lives in `api::http::request_error`: it strips the request
//! URL (which carries API keys) from every provider error before it is logged
//! or returned to the UI.

use log::LevelFilter;

/// Maps the `TAURI_APP_LOG` env var to a `LevelFilter`.
/// Unset, empty, or unrecognised values default to `Info`, so a typo never
/// silently turns logging all the way up (`Trace`) or off (`Off`).
pub fn level_from_env(value: Option<&str>) -> LevelFilter {
    match value.map(str::trim).map(str::to_ascii_lowercase).as_deref() {
        Some("trace") => LevelFilter::Trace,
        Some("debug") => LevelFilter::Debug,
        Some("info") => LevelFilter::Info,
        Some("warn") => LevelFilter::Warn,
        Some("error") => LevelFilter::Error,
        Some("off") => LevelFilter::Off,
        _ => LevelFilter::Info,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn level_from_env_defaults_to_info_when_unset() {
        assert_eq!(level_from_env(None), LevelFilter::Info);
    }

    #[test]
    fn level_from_env_defaults_to_info_on_empty_or_garbage() {
        assert_eq!(level_from_env(Some("")), LevelFilter::Info);
        assert_eq!(level_from_env(Some("nonsense")), LevelFilter::Info);
    }

    #[test]
    fn level_from_env_parses_every_known_level_case_insensitively() {
        assert_eq!(level_from_env(Some("trace")), LevelFilter::Trace);
        assert_eq!(level_from_env(Some("DEBUG")), LevelFilter::Debug);
        assert_eq!(level_from_env(Some(" Info ")), LevelFilter::Info);
        assert_eq!(level_from_env(Some("WARN")), LevelFilter::Warn);
        assert_eq!(level_from_env(Some("error")), LevelFilter::Error);
        assert_eq!(level_from_env(Some("Off")), LevelFilter::Off);
    }
}
