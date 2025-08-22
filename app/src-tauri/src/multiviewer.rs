use axum::{
    extract::{ws::WebSocket, WebSocketUpgrade},
    http::StatusCode,
    response::{Html, IntoResponse},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tower_http::cors::CorsLayer;
use crate::state::AppState;
use crate::app_log;
use crate::types::MultiviewerConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiviewerData {
    pub inputs: Vec<MultiviewerInput>,
    pub active_input: i32,
    pub preview_input: i32,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiviewerInput {
    pub number: i32,
    pub title: String,
    pub input_type: String,
    pub state: String,
    pub thumbnail_url: Option<String>,
}

pub struct MultiviewerServer {
    app_state: Arc<AppState>,
    server_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

// Ensure MultiviewerServer is Send
unsafe impl Send for MultiviewerServer {}
unsafe impl Sync for MultiviewerServer {}

impl MultiviewerServer {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            server_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let app_state = self.app_state.clone();
        let config = app_state.get_multiviewer_config();

        let app = Router::new()
            .route("/", get(serve_multiviewer_page))
            .route("/api/data", get(get_multiviewer_data))
            .route("/api/config", get(get_config))
            .route("/ws", get(websocket_handler))
            .layer(CorsLayer::permissive())
            .with_state(app_state);

        let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", config.port)).await?;
        app_log!(info, "Multiviewer server starting on port {}", config.port);

        let server_handle = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        {
            let mut handle_guard = self.server_handle.lock().unwrap();
            *handle_guard = Some(server_handle);
        }
        Ok(())
    }

    pub async fn stop(&self) {
        let handle = {
            let mut handle_guard = self.server_handle.lock().unwrap();
            handle_guard.take()
        };
        
        if let Some(handle) = handle {
            handle.abort();
            app_log!(info, "Multiviewer server stopped");
        }
    }
}

async fn serve_multiviewer_page() -> Html<&'static str> {
    Html(include_str!("../multiviewer/index.html"))
}

async fn get_multiviewer_data(
    axum::extract::State(_state): axum::extract::State<Arc<crate::state::AppState>>,
) -> Result<Json<MultiviewerData>, StatusCode> {
    // For now, return empty data since we need to implement proper data fetching
    let empty_data = MultiviewerData {
        inputs: Vec::new(),
        active_input: 0,
        preview_input: 0,
        timestamp: chrono::Utc::now(),
    };
    Ok(Json(empty_data))
}

async fn get_config(
    axum::extract::State(state): axum::extract::State<Arc<crate::state::AppState>>,
) -> Json<MultiviewerConfig> {
    let config = state.get_multiviewer_config();
    Json(config)
}



async fn websocket_handler(
    ws: WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<Arc<crate::state::AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<crate::state::AppState>) {
    let config = state.get_multiviewer_config();
    let interval = std::time::Duration::from_millis(config.refresh_interval);
    
    let mut interval_timer = tokio::time::interval(interval);
    
    loop {
        tokio::select! {
            _ = interval_timer.tick() => {
                // For now, send empty data
                let empty_data = MultiviewerData {
                    inputs: Vec::new(),
                    active_input: 0,
                    preview_input: 0,
                    timestamp: chrono::Utc::now(),
                };
                
                if let Ok(json) = serde_json::to_string(&empty_data) {
                    if socket.send(axum::extract::ws::Message::Text(json)).await.is_err() {
                        break;
                    }
                }
            }
            else => {
                break;
            }
        }
    }
}
