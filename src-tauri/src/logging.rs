//! Pure helpers for the debug-logging setup (A8). Kept side-effect-free and
//! unit-tested directly; `lib.rs` wires them into the `tauri-plugin-log`
//! builder, which is not itself unit-testable (it talks to the OS/log crate).

use tauri_plugin_log::log::LevelFilter;

/// Maps the `TAURI_APP_LOG` env var to a `log::LevelFilter`.
/// Unset, empty, or unrecognised values default to `Info` -- never silently
/// fail loud (`Trace`) or silent (`Off`) on a typo.
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

/// Replaces every occurrence of `secret` in `text` with `[REDACTED]`.
/// No-ops if `secret` is empty (an empty needle would match everywhere and
/// corrupt the string) or absent from `text`.
pub fn redact(text: &str, secret: &str) -> String {
    if secret.is_empty() {
        return text.to_string();
    }
    text.replace(secret, "[REDACTED]")
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

    #[test]
    fn redact_masks_the_secret_wherever_it_appears() {
        assert_eq!(
            redact("https://api.example.com?key=abc123&x=1", "abc123"),
            "https://api.example.com?key=[REDACTED]&x=1"
        );
    }

    #[test]
    fn redact_is_a_noop_on_empty_secret_or_no_match() {
        assert_eq!(redact("hello world", ""), "hello world");
        assert_eq!(redact("hello world", "xyz"), "hello world");
    }
}
