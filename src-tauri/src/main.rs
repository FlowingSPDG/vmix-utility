#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[tokio::main]
async fn main() -> reqwest::Result<()> {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_xml,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}

mod vmix;

#[tauri::command]
async fn get_xml(url: String) -> vmix::VMixRoot {
    let body = reqwest::get(url).await.unwrap().text().await.unwrap();

    let vm = vmix::parse_vmix_api(body.as_str()).unwrap();
    println!("got vm: {:#?} ",vm);

    vm
}