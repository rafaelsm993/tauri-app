use reqwest::Client;
use serde_json::Value;

const BASE_URL: &str = "https://openlibrary.org";

#[tauri::command]
pub async fn search_books(query: &str, page: u32) -> Result<Value, String> {
    let offset = ((page - 1) * 20).to_string();
    let params = [
        ("q", query),
        ("limit", "20"),
        ("offset", offset.as_str()),
        ("fields", "key,title,author_name,cover_i,first_publish_year,ratings_average,subject"),
    ];

    Client::new()
        .get(format!("{BASE_URL}/search.json"))
        .query(&params)
        .send()
        .await
        .map_err(|e: reqwest::Error| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e: reqwest::Error| e.to_string())
}

#[tauri::command]
pub async fn book_details(key: &str) -> Result<Value, String> {
    Client::new()
        .get(format!("{BASE_URL}{key}.json"))
        .send()
        .await
        .map_err(|e: reqwest::Error| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e: reqwest::Error| e.to_string())
}