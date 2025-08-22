use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Html,
    routing::get,
    Router,
};
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use crate::types::MultiviewerConfig;
use crate::app_log;

// Multiviewer data structures
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MultiviewerData {
    pub inputs: Vec<MultiviewerInput>,
    pub active_input: Option<i32>,
    pub preview_input: Option<i32>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MultiviewerInput {
    pub number: i32,
    pub name: String,
    pub state: String,
}

#[derive(Clone)]
pub struct MultiviewerServer {
    config: Arc<Mutex<MultiviewerConfig>>,
    app_state: Arc<crate::state::AppState>,
    server_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    broadcast_tx: Arc<Mutex<Option<broadcast::Sender<MultiviewerData>>>>,
}

impl MultiviewerServer {
    pub fn new(app_state: Arc<crate::state::AppState>) -> Self {
        Self {
            config: Arc::new(Mutex::new(MultiviewerConfig::default())),
            app_state,
            server_handle: Arc::new(Mutex::new(None)),
            broadcast_tx: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let config = self.config.lock().unwrap().clone();
        if !config.enabled {
            return Ok(());
        }

        // Create broadcast channel for WebSocket updates
        let (broadcast_tx, _) = broadcast::channel::<MultiviewerData>(100);
        {
            let mut tx_guard = self.broadcast_tx.lock().unwrap();
            *tx_guard = Some(broadcast_tx.clone());
        }

        let app_state = Arc::clone(&self.app_state);
        let config_arc = Arc::clone(&self.config);
        let broadcast_tx_clone = broadcast_tx.clone();

        // Set up router with /multiviewers prefix
        let app = Router::new()
            .route("/multiviewers", get(Self::serve_multiviewer_page))
            .route("/multiviewers/api/data", get(Self::get_multiviewer_data))
            .route("/multiviewers/api/config", get(Self::get_config_handler))
            .route("/multiviewers/ws", get(Self::websocket_handler))
            .with_state(Arc::new(self.clone()));

        let addr: std::net::SocketAddr = format!("127.0.0.1:{}", config.port).parse()?;
        
        let handle = tokio::spawn(async move {
            app_log!(info, "Starting multiviewer server on {}", addr);
            
            // Set up timer-based updates for now (will be replaced with event-driven updates)
            let broadcast_tx_clone = broadcast_tx_clone.clone();
            let config = config_arc.lock().unwrap().clone();
            
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_millis(config.refresh_interval));
                loop {
                    interval.tick().await;
                    
                    // For now, send empty data as placeholder
                    let multiviewer_data = MultiviewerData {
                        inputs: vec![],
                        active_input: None,
                        preview_input: None,
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64,
                    };
                    
                    if let Err(e) = broadcast_tx_clone.send(multiviewer_data) {
                        app_log!(warn, "Failed to broadcast multiviewer data: {}", e);
                    }
                }
            });

            // Start the server
            let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
            axum::serve(listener, app).await.unwrap();
        });

        {
            let mut handle_guard = self.server_handle.lock().unwrap();
            *handle_guard = Some(handle);
        }

        Ok(())
    }

    pub fn stop(&self) {
        if let Some(handle) = self.server_handle.lock().unwrap().take() {
            handle.abort();
            app_log!(info, "Multiviewer server stopped");
        }
    }

    pub fn update_config(&self, new_config: MultiviewerConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut config_guard = self.config.lock().unwrap();
        let old_config = config_guard.clone();
        *config_guard = new_config.clone();

        // If server needs to be restarted (port changed or enabled/disabled)
        if old_config.port != new_config.port || old_config.enabled != new_config.enabled {
            self.stop();
            if new_config.enabled {
                self.start()?;
            }
        }

        Ok(())
    }

    pub fn get_config(&self) -> MultiviewerConfig {
        self.config.lock().unwrap().clone()
    }

    // Convert vMix connection status to multiviewer data
    fn convert_vmix_status_to_multiviewer_data(connection: &crate::types::VmixConnection) -> MultiviewerData {
        // For now, return basic data. This should be enhanced to fetch actual input data
        MultiviewerData {
            inputs: vec![], // TODO: Fetch actual inputs from vMix
            active_input: Some(connection.active_input),
            preview_input: Some(connection.preview_input),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        }
    }

    // Axum handlers
    async fn serve_multiviewer_page() -> Html<&'static str> {
        Html(include_str!("../multiviewer/index.html"))
    }

    async fn get_multiviewer_data() -> axum::Json<MultiviewerData> {
        // Return empty data for now - will be populated via WebSocket
        axum::Json(MultiviewerData {
            inputs: vec![],
            active_input: None,
            preview_input: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        })
    }

    async fn get_config_handler() -> axum::Json<MultiviewerConfig> {
        // This would need to be implemented to return the current config
        axum::Json(MultiviewerConfig::default())
    }

    async fn websocket_handler(
        ws: WebSocketUpgrade,
        axum::extract::State(state): axum::extract::State<Arc<Self>>,
    ) -> impl axum::response::IntoResponse {
        ws.on_upgrade(|socket| Self::handle_socket(socket, state))
    }

    async fn handle_socket(mut socket: WebSocket, state: Arc<Self>) {
        let mut rx = {
            let tx_guard = state.broadcast_tx.lock().unwrap();
            if let Some(tx) = &*tx_guard {
                tx.subscribe()
            } else {
                return;
            }
        };

        // Send initial data
        let initial_data = MultiviewerData {
            inputs: vec![],
            active_input: None,
            preview_input: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        };

        if let Err(e) = socket.send(Message::Text(serde_json::to_string(&initial_data).unwrap())).await {
            app_log!(error, "Failed to send initial data: {}", e);
            return;
        }

        // Listen for broadcast messages
        while let Ok(data) = rx.recv().await {
            if let Err(e) = socket.send(Message::Text(serde_json::to_string(&data).unwrap())).await {
                app_log!(error, "Failed to send WebSocket message: {}", e);
                break;
            }
        }
    }
}

unsafe impl Send for MultiviewerServer {}
unsafe impl Sync for MultiviewerServer {}
