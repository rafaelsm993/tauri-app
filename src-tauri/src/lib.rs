pub mod api;

#[cfg(debug_assertions)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Linux/WebKitGTK: the DMA-BUF renderer paints detached windows (e.g. the
    // Web Inspector) solid black on Wayland + AMD. Disable it unless the user
    // already chose a value. Must run before the webview initialises.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            // Dev builds only: open the Web Inspector on start (no right-click needed).
            // Release builds compile this out entirely.
            #[cfg(debug_assertions)]
            if let Some(window) = _app.get_webview_window("main") {
                window.open_devtools();
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
