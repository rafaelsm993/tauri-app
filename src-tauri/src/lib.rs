pub mod api;

use api::watchlist::DbConn;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = DbConn::new("tauriflix.db").expect("Failed to open database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(db)
        .invoke_handler(tauri::generate_handler![
            greet,
            // ── TMDB (movies + series) ──
            api::tmdb::tmdb_discover_movies,
            api::tmdb::tmdb_search_movies,
            api::tmdb::tmdb_movie_details,
            api::tmdb::tmdb_genres_movies,
            api::tmdb::tmdb_discover_tv,
            api::tmdb::tmdb_search_tv,
            api::tmdb::tmdb_tv_details,
            api::tmdb::tmdb_genres_tv,
            // ── Jikan / iTunes (anime/manga/books) ──
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
            api::rawg::rawg_genres,
            // ── Auth (local SQLite) ──
            api::auth::auth_register,
            api::auth::auth_login,
            api::auth::auth_get_user,
            api::auth::auth_list_users,
            // ── Watchlist (local SQLite, per-user) ──
            api::watchlist::add_to_watchlist,
            api::watchlist::remove_from_watchlist,
            api::watchlist::update_watchlist_status,
            api::watchlist::get_watchlist,
            api::watchlist::get_watchlist_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
