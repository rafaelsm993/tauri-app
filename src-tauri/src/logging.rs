//! Pure, unit-tested helpers for the `tauri-plugin-log` setup wired in `lib.rs`.

use log::LevelFilter;

/// `Debug` in dev builds, `Info` in release, when `TAURI_APP_LOG` is unset.
pub fn default_level(dev_build: bool) -> LevelFilter {
    if dev_build {
        LevelFilter::Debug
    } else {
        LevelFilter::Info
    }
}

/// Unrecognised `TAURI_APP_LOG` values fall back to `default` so a typo never means `Trace` or `Off`.
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

/// Noisy third-party crates, capped at `Info` unless `trace` is requested.
pub const NOISY_CRATES: &[&str] = &["hyper", "hyper_util", "reqwest", "rustls", "tao", "wry"];

pub fn noisy_crate_level(level: LevelFilter) -> LevelFilter {
    if level == LevelFilter::Trace {
        LevelFilter::Trace
    } else {
        level.min(LevelFilter::Info)
    }
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
}
