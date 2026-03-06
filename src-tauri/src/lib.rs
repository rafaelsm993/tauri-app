pub mod api;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            // ── TMDB ──
            api::tmdb::search_movies,
            api::tmdb::search_series,
            api::tmdb::discover_movies,   // was missing!
            api::tmdb::discover_series,   // was missing!
            api::tmdb::movie_details,
            api::tmdb::series_details,
            // ── Jikan / OpenLibrary ──
            api::jikan::search_anime,
            api::jikan::anime_details,
            api::openlib::search_books,
            api::openlib::book_details
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}