use crate::app_log;
use crate::state::AppState;
use axum::{
    extract::{ws::WebSocketUpgrade, State, Path},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;

pub struct HttpServerManager {
    server_handle: Arc<tokio::sync::Mutex<Option<tokio::task::JoinHandle<()>>>>,
    app_handle: Option<AppHandle>,
}

impl HttpServerManager {
    pub fn new() -> Self {
        Self {
            server_handle: Arc::new(tokio::sync::Mutex::new(None)),
            app_handle: None,
        }
    }

    pub async fn start(
        &mut self,
        port: u16,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        // Stop existing server if running
        self.stop().await;

        self.app_handle = Some(app_handle.clone());
        
        let app_handle_for_router = app_handle.clone();

        // Create router - pass app_handle and access state through it
        let app = Router::new()
            .route("/api/vmix/status", get(get_vmix_status_handler))
            .route("/api/vmix/status/:host", get(get_vmix_status_by_host_handler))
            .route("/ws", get(websocket_handler))
            .with_state(app_handle_for_router);

        let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
            .await
            .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?;

        app_log!(info, "HTTP server started on port {}", port);

        let handle = tokio::spawn(async move {
            let axum_server = axum::serve(listener, app);
            if let Err(e) = axum_server.await {
                app_log!(error, "HTTP server error: {}", e);
            }
        });

        {
            let mut handle_guard = self.server_handle.lock().await;
            *handle_guard = Some(handle);
        }

        Ok(())
    }

    pub async fn stop(&self) {
        let mut handle_guard = self.server_handle.lock().await;
        if let Some(handle) = handle_guard.take() {
            handle.abort();
            app_log!(info, "HTTP server stopped");
        }
    }

    pub async fn is_running(&self) -> bool {
        let handle_guard = self.server_handle.lock().await;
        handle_guard.is_some()
    }
}


async fn get_vmix_status_handler(
    State(app_handle): State<AppHandle>,
) -> impl IntoResponse {
    let state = app_handle.state::<AppState>();
    // Get all vMix connections
    let http_connections = {
        let guard = state.http_connections.lock().unwrap();
        guard.clone()
    };

    let tcp_connections = {
        let guard = state.tcp_connections.lock().unwrap();
        guard.iter().map(|c| (c.host().to_string(), c.port(), c.is_connected())).collect::<Vec<_>>()
    };

    let mut statuses = Vec::new();

    // Get HTTP connection statuses
    for vmix in http_connections.iter() {
        let host = vmix.host().to_string();
        let status = vmix.get_status().await.unwrap_or(false);
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);

        let (version, edition, preset) = match vmix.get_vmix_data().await {
            Ok(data) => (data.version, data.edition, data.preset),
            Err(_) => ("Unknown".to_string(), "Unknown".to_string(), None),
        };

        statuses.push(json!({
            "host": host,
            "port": vmix.port(),
            "status": if status { "Connected" } else { "Disconnected" },
            "active_input": active_input,
            "preview_input": preview_input,
            "version": version,
            "edition": edition,
            "preset": preset,
            "connection_type": "Http"
        }));
    }

    // Get TCP connection statuses
    for (host, port, tcp_status) in tcp_connections {
        let (active_input, preview_input, version, edition, preset) = {
            let cache = state.last_status_cache.lock().unwrap();
            if let Some(cached) = cache.get(&host) {
                (cached.active_input, cached.preview_input, cached.version.clone(), cached.edition.clone(), cached.preset.clone())
            } else {
                (1, 1, "Unknown".to_string(), "Unknown".to_string(), None)
            }
        };

        statuses.push(json!({
            "host": host,
            "port": port,
            "status": if tcp_status { "Connected" } else { "Disconnected" },
            "active_input": active_input,
            "preview_input": preview_input,
            "version": version,
            "edition": edition,
            "preset": preset,
            "connection_type": "Tcp"
        }));
    }

    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&statuses).unwrap())
        .unwrap()
        .into_response()
}

async fn get_vmix_status_by_host_handler(
    State(app_handle): State<AppHandle>,
    Path(host): Path<String>,
) -> impl IntoResponse {
    let state = app_handle.state::<AppState>();
    // Try HTTP connection first
    let http_result = {
        let http_connections = state.http_connections.lock().unwrap();
        http_connections.iter().find(|c| c.host() == host).cloned()
    };

    if let Some(vmix) = http_result {
        let status = vmix.get_status().await.unwrap_or(false);
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);

        let (version, edition, preset) = match vmix.get_vmix_data().await {
            Ok(data) => (data.version, data.edition, data.preset),
            Err(_) => ("Unknown".to_string(), "Unknown".to_string(), None),
        };

        let response = json!({
            "host": host,
            "port": vmix.port(),
            "status": if status { "Connected" } else { "Disconnected" },
            "active_input": active_input,
            "preview_input": preview_input,
            "version": version,
            "edition": edition,
            "preset": preset,
            "connection_type": "Http"
        });

        return Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "application/json")
            .body(serde_json::to_string(&response).unwrap())
            .unwrap()
            .into_response();
    }

    // Try TCP connection
    let tcp_result = {
        let tcp_connections = state.tcp_connections.lock().unwrap();
        tcp_connections.iter().find(|c| c.host() == host).map(|c| (c.port(), c.is_connected()))
    };

    if let Some((port, tcp_status)) = tcp_result {
        let (active_input, preview_input, version, edition, preset) = {
            let cache = state.last_status_cache.lock().unwrap();
            if let Some(cached) = cache.get(&host) {
                (cached.active_input, cached.preview_input, cached.version.clone(), cached.edition.clone(), cached.preset.clone())
            } else {
                (1, 1, "Unknown".to_string(), "Unknown".to_string(), None)
            }
        };

        let response = json!({
            "host": host,
            "port": port,
            "status": if tcp_status { "Connected" } else { "Disconnected" },
            "active_input": active_input,
            "preview_input": preview_input,
            "version": version,
            "edition": edition,
            "preset": preset,
            "connection_type": "Tcp"
        });

        return Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "application/json")
            .body(serde_json::to_string(&response).unwrap())
            .unwrap()
            .into_response();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body("vMix connection not found".to_string())
        .unwrap()
        .into_response()
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(app_handle): State<AppHandle>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, app_handle))
}

async fn handle_socket(
    socket: axum::extract::ws::WebSocket,
    app_handle: AppHandle,
) {
    let (mut sender, mut receiver) = socket.split();
    let state = app_handle.state::<AppState>();

    // Send initial status
    let initial_status = get_all_vmix_statuses(&state).await;
    if let Err(e) = sender.send(axum::extract::ws::Message::Text(
        serde_json::to_string(&json!({
            "type": "status",
            "data": initial_status
        })).unwrap()
    )).await {
        app_log!(error, "Failed to send initial status: {}", e);
        return;
    }

    // Handle incoming messages
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(axum::extract::ws::Message::Text(text)) => {
                if text == "ping" {
                    let _ = sender.send(axum::extract::ws::Message::Text("pong".to_string())).await;
                } else if text == "get_status" {
                    let state = app_handle.state::<AppState>();
                    let status = get_all_vmix_statuses(&state).await;
                    let message = json!({
                        "type": "status",
                        "data": status
                    });
                    let _ = sender.send(axum::extract::ws::Message::Text(
                        serde_json::to_string(&message).unwrap()
                    )).await;
                }
            }
            Ok(axum::extract::ws::Message::Close(_)) => {
                break;
            }
            Err(e) => {
                app_log!(error, "WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }
}

async fn get_all_vmix_statuses(state: &tauri::State<'_, AppState>) -> serde_json::Value {
    let http_connections = {
        let guard = state.http_connections.lock().unwrap();
        guard.clone()
    };

    let mut statuses = Vec::new();

    for vmix in http_connections.iter() {
        let host = vmix.host().to_string();
        let status = vmix.get_status().await.unwrap_or(false);
        let active_input = vmix.get_active_input().await.unwrap_or(0);
        let preview_input = vmix.get_preview_input().await.unwrap_or(0);

        let (version, edition, preset) = match vmix.get_vmix_data().await {
            Ok(data) => (data.version, data.edition, data.preset),
            Err(_) => ("Unknown".to_string(), "Unknown".to_string(), None),
        };

        statuses.push(json!({
            "host": host,
            "port": vmix.port(),
            "status": if status { "Connected" } else { "Disconnected" },
            "active_input": active_input,
            "preview_input": preview_input,
            "version": version,
            "edition": edition,
            "preset": preset,
            "connection_type": "Http"
        }));
    }

    json!(statuses)
}

