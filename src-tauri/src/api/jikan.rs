use reqwest::Client;
use serde_json::Value;

const BASE_URL: &str = "https://api.jikan.moe/v4";

#[tauri::command]
pub async fn search_anime(query: &str, page: u32) -> Result<Value, String> {
    let page_str = page.to_string();
    let limit_str = "20";
    let params = [
        ("q", query),
        ("page", page_str.as_str()),
        ("limit", limit_str),
    ];

    Client::new()
        .get(format!("{BASE_URL}/anime"))
        .query(&params)
        .send()
        .await
        .map_err(|e: reqwest::Error| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e: reqwest::Error| e.to_string())
}

#[tauri::command]
pub async fn anime_details(id: u32) -> Result<Value, String> {
    Client::new()
        .get(format!("{BASE_URL}/anime/{id}/full"))
        .send()
        .await
        .map_err(|e: reqwest::Error| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e: reqwest::Error| e.to_string())
}