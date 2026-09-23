use super::http::{client as http, fetch_json};
use serde_json::Value;

const BASE: &str = "https://api.themoviedb.org/3";
const LANG: &str = "en-US";

// Runtime env wins; falls back to the key baked in from `.env` by build.rs.
fn api_key() -> String {
    std::env::var("TMDB_API_KEY").unwrap_or_else(|_| env!("TMDB_API_KEY").to_string())
}

// A genre id switches from /movie/popular to /discover/movie with `with_genres`.
#[tauri::command]
pub async fn tmdb_discover_movies(page: u32, genre: Option<u32>) -> Result<Value, String> {
    log::debug!("[tmdb] discover_movies  page={} genre={:?}", page, genre);
    let key = api_key();
    let p = page.to_string();
    let req = if let Some(gid) = genre {
        let g = gid.to_string();
        http().get(format!("{BASE}/discover/movie")).query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("page", p.as_str()),
            ("sort_by", "popularity.desc"),
            ("include_adult", "false"),
            ("with_genres", g.as_str()),
        ])
    } else {
        http().get(format!("{BASE}/movie/popular")).query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("page", p.as_str()),
        ])
    };
    let res = fetch_json("tmdb", "discover_movies", req).await?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_genres_movies() -> Result<Value, String> {
    log::debug!("[tmdb] genres_movies");
    let key = api_key();
    let res = fetch_json(
        "tmdb",
        "genres_movies",
        http()
            .get(format!("{BASE}/genre/movie/list"))
            .query(&[("api_key", key.as_str()), ("language", LANG)]),
    )
    .await?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_search_movies(query: &str, page: u32) -> Result<Value, String> {
    log::debug!("[tmdb] search_movies  query={:?} page={}", query, page);
    let key = api_key();
    let p = page.to_string();
    let res = fetch_json(
        "tmdb",
        "search_movies",
        http().get(format!("{BASE}/search/movie")).query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("query", query),
            ("page", p.as_str()),
            ("include_adult", "false"),
        ]),
    )
    .await?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_movie_details(id: u32) -> Result<Value, String> {
    log::debug!("[tmdb] movie_details  id={}", id);
    let key = api_key();
    let res = fetch_json(
        "tmdb",
        "movie_details",
        http().get(format!("{BASE}/movie/{id}")).query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("append_to_response", "credits,videos"),
        ]),
    )
    .await?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_discover_tv(page: u32, genre: Option<u32>) -> Result<Value, String> {
    log::debug!("[tmdb] discover_tv  page={} genre={:?}", page, genre);
    let key = api_key();
    let p = page.to_string();
    let req = if let Some(gid) = genre {
        let g = gid.to_string();
        http().get(format!("{BASE}/discover/tv")).query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("page", p.as_str()),
            ("sort_by", "popularity.desc"),
            ("include_adult", "false"),
            ("with_genres", g.as_str()),
        ])
    } else {
        http().get(format!("{BASE}/tv/popular")).query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("page", p.as_str()),
        ])
    };
    let res = fetch_json("tmdb", "discover_tv", req).await?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_genres_tv() -> Result<Value, String> {
    log::debug!("[tmdb] genres_tv");
    let key = api_key();
    let res = fetch_json(
        "tmdb",
        "genres_tv",
        http()
            .get(format!("{BASE}/genre/tv/list"))
            .query(&[("api_key", key.as_str()), ("language", LANG)]),
    )
    .await?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_search_tv(query: &str, page: u32) -> Result<Value, String> {
    log::debug!("[tmdb] search_tv  query={:?} page={}", query, page);
    let key = api_key();
    let p = page.to_string();
    let res = fetch_json(
        "tmdb",
        "search_tv",
        http().get(format!("{BASE}/search/tv")).query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("query", query),
            ("page", p.as_str()),
            ("include_adult", "false"),
        ]),
    )
    .await?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_tv_details(id: u32) -> Result<Value, String> {
    log::debug!("[tmdb] tv_details  id={}", id);
    let key = api_key();
    let res = fetch_json(
        "tmdb",
        "tv_details",
        http().get(format!("{BASE}/tv/{id}")).query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("append_to_response", "credits,videos"),
        ]),
    )
    .await?;
    if let Some(status_msg) = res.get("status_message").and_then(|v| v.as_str()) {
        return Err(status_msg.to_string());
    }
    Ok(res)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_english_content() {
        assert_eq!(LANG, "en-US");
    }
}
