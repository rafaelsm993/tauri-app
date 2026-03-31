use reqwest::Client;
use serde_json::Value;

const BASE_URL: &str = "https://openlibrary.org";

#[tauri::command]
pub async fn search_books(query: &str, page: u32) -> Result<Value, String> {
    eprintln!("[openlib] search_books  query={:?} page={}", query, page);
    let offset = ((page - 1) * 20).to_string();
    let params = [
        ("q", query),
        ("limit", "20"),
        ("offset", offset.as_str()),
        ("fields", "key,title,author_name,cover_i,first_publish_year,ratings_average,subject,number_of_pages_median"),
    ];

    let res = Client::new()
        .get(format!("{BASE_URL}/search.json"))
        .query(&params)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[openlib] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    eprintln!(
        "[openlib] search_books → {} results, numFound={}",
        res["docs"].as_array().map(|a| a.len()).unwrap_or(0),
        res["numFound"].as_u64().unwrap_or(0)
    );
    Ok(res)
}

#[tauri::command]
pub async fn book_details(key: &str) -> Result<Value, String> {
    eprintln!("[openlib] book_details  key={:?}", key);
    let res = Client::new()
        .get(format!("{BASE_URL}{key}.json"))
        .send()
        .await
        .map_err(|e| {
            eprintln!("[openlib] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    eprintln!("[openlib] book_details → title={:?}", res["title"]);
    Ok(res)
}
