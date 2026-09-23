pub mod api;

#[cfg(debug_assertions)]
use tauri::Manager;

/// Dev builds only: `TAURI_APP_DEVTOOLS=1 npm run tauri dev` opens the Web Inspector on start.
/// Opt-in because a docked inspector costs viewport and CPU on every run; right-click →
/// Inspect Element still works regardless (see `tauri.conf.json`'s `devtools: true`).
#[cfg(debug_assertions)]
fn devtools_requested(value: Option<&str>) -> bool {
    value.is_some_and(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            #[cfg(debug_assertions)]
            if devtools_requested(std::env::var("TAURI_APP_DEVTOOLS").ok().as_deref()) {
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ── TMDB (movies + series) ──
            api::tmdb::tmdb_discover_movies,
            api::tmdb::tmdb_search_movies,
            api::tmdb::tmdb_movie_details,
            api::tmdb::tmdb_genres_movies,
            api::tmdb::tmdb_discover_tv,
            api::tmdb::tmdb_search_tv,
            api::tmdb::tmdb_tv_details,
            api::tmdb::tmdb_genres_tv,
            // ── AniList / iTunes (anime, manga, books) ──
            api::anilist::anilist_search_anime,
            api::anilist::anilist_anime_details,
            api::anilist::anilist_search_manga,
            api::anilist::anilist_manga_details,
            api::anilist::anilist_genres,
            api::itunes::itunes_search,
            api::itunes::itunes_details,
            // ── RAWG (games) ──
            api::rawg::rawg_search,
            api::rawg::rawg_discover,
            api::rawg::rawg_details,
            api::rawg::rawg_genres
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(all(test, debug_assertions))]
mod tests {
    use super::devtools_requested;

    #[test]
    fn devtools_off_when_unset_or_empty() {
        assert!(!devtools_requested(None));
        assert!(!devtools_requested(Some("")));
        assert!(!devtools_requested(Some("0")));
        assert!(!devtools_requested(Some("false")));
    }

    #[test]
    fn devtools_on_for_truthy_values() {
        assert!(devtools_requested(Some("1")));
        assert!(devtools_requested(Some("true")));
        assert!(devtools_requested(Some(" YES ")));
    }
}
