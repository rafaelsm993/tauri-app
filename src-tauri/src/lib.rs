pub mod api;

use sqlx::postgres::PgPoolOptions;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL não encontrado. Verifique seu arquivo .env");

    let pool = tauri::async_runtime::block_on(async {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("Falha ao conectar ao PostgreSQL. Verifique se o banco está rodando.");

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Falha ao executar migrations do banco de dados.");

        pool
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(pool)
        .invoke_handler(tauri::generate_handler![
            greet,
            // ── TMDB ──
            api::tmdb::search_movies,
            api::tmdb::search_series,
            api::tmdb::discover_movies,
            api::tmdb::discover_series,
            api::tmdb::movie_details,
            api::tmdb::series_details,
            // ── Jikan / OpenLibrary ──
            api::jikan::search_anime,
            api::jikan::anime_details,
            api::openlib::search_books,
            api::openlib::book_details,
            // ── Auth ──
            api::auth::register_user,
            api::auth::login_user,
            api::auth::list_users,
            // ── Watchlist persistence ──
            api::store::load_watchlist,
            api::store::save_watchlist
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
