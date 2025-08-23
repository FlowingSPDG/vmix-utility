use axum::{
    extract::{Query, ws::{Message, WebSocket, WebSocketUpgrade}},
    response::Html,
    routing::get,
    Router,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use crate::types::MultiviewerConfig;
use crate::app_log;
// Remove unused imports for now

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
    pub key: String,
    pub number: i32,
    pub name: String,
    pub state: String,
    pub layers: Vec<MultiviewerLayer>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MultiviewerLayer {
    pub index: i32,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub crop: Option<String>,
    pub zorder: i32,
    pub panx: f64,
    pub pany: f64,
    pub zoom: f64,
    pub input_key: String,
    pub input_name: String,
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

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
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

        // Setup event-driven updates by monitoring the inputs cache
        let _broadcast_for_cache_updates = broadcast_tx.clone();
        let _app_state_for_cache = Arc::clone(&app_state);
        let _config_for_cache = Arc::clone(&config_arc);

        // Set up router with /multiviewer prefix (note: singular, not plural)
        let app = Router::new()
            .route("/multiviewer", get(Self::serve_multiviewer_page))
            .route("/multiviewer/api/data", get(Self::get_multiviewer_data))
            .route("/multiviewer/api/layers", get(Self::get_multiviewer_layers))
            .route("/multiviewer/api/config", get(Self::get_config_handler))
            .route("/multiviewer/ws", get(Self::websocket_handler))
            .with_state(Arc::new(self.clone()));

        let addr: std::net::SocketAddr = format!("127.0.0.1:{}", config.port).parse()?;
        
        let addr_clone = addr;
        let handle = tokio::spawn(async move {
            app_log!(info, "Starting multiviewer server on {}", addr_clone);
            
            // Set up event-driven updates integrated with existing auto-refresh system
            let broadcast_tx_clone = broadcast_tx_clone.clone();
            let config = config_arc.lock().unwrap().clone();
            let app_state_clone = Arc::clone(&app_state);
            
            // Send initial data
            tokio::spawn({
                let broadcast_tx = broadcast_tx_clone.clone();
                let app_state = Arc::clone(&app_state_clone);
                let config = config.clone();
                
                async move {
                    // For initial broadcast, we don't have a specific input key, so skip it
                    // The frontend will request specific data via the API endpoint
                    let initial_data = Self::create_empty_multiviewer_data();
                    if let Err(e) = broadcast_tx.send(initial_data) {
                        app_log!(warn, "Failed to send initial multiviewer data: {}", e);
                    }
                }
            });
            
            // Set up a fallback timer for periodic updates (in case events are missed)
            tokio::spawn({
                let broadcast_tx = broadcast_tx_clone.clone();
                let app_state = Arc::clone(&app_state_clone);
                let config_arc = Arc::clone(&config_arc);
                
                async move {
                    let mut interval = tokio::time::interval(std::time::Duration::from_secs(
                        30 // Fallback safety timer - 30 seconds for rare edge cases
                    ));
                    
                    loop {
                        interval.tick().await;
                        
                        // For periodic updates without specific input key, send empty data
                        // Real data updates happen via the API endpoint when frontend requests specific input
                        let multiviewer_data = Self::create_empty_multiviewer_data();
                        
                        if let Err(e) = broadcast_tx.send(multiviewer_data) {
                            app_log!(warn, "Failed to broadcast fallback multiviewer data: {}", e);
                        }
                    }
                }
            });

            // Start the server
            match tokio::net::TcpListener::bind(addr_clone).await {
                Ok(listener) => {
                    app_log!(info, "Multiviewer server successfully bound to {}", addr_clone);
                    if let Err(e) = axum::serve(listener, app).await {
                        app_log!(error, "Multiviewer server error: {}", e);
                    } else {
                        app_log!(info, "Multiviewer server stopped gracefully");
                    }
                }
                Err(e) => {
                    app_log!(error, "Failed to bind multiviewer server to {}: {}", addr_clone, e);
                }
            }
        });

        {
            let mut handle_guard = self.server_handle.lock().unwrap();
            *handle_guard = Some(handle);
        }

        // Give the server a brief moment to start and verify it's working
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Simple check to verify the server is running
        match std::net::TcpStream::connect(format!("127.0.0.1:{}", config.port)) {
            Ok(_) => {
                app_log!(info, "Multiviewer server successfully started on port {}", config.port);
            },
            Err(e) => {
                app_log!(warn, "Multiviewer server may not have started properly on port {}: {}", config.port, e);
                // Don't return error here as the server might still be starting up
            }
        }

        Ok(())
    }

    pub fn stop(&self) {
        if let Some(handle) = self.server_handle.lock().unwrap().take() {
            handle.abort();
            app_log!(info, "Multiviewer server stopped");
        }
    }

    pub async fn update_config(&self, new_config: MultiviewerConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let old_config = {
            let mut config_guard = self.config.lock().unwrap();
            let old_config = config_guard.clone();
            *config_guard = new_config.clone();
            old_config
        }; // Drop mutex guard before await

        // If server needs to be restarted (port changed or enabled/disabled)
        if old_config.port != new_config.port || old_config.enabled != new_config.enabled {
            self.stop();
            if new_config.enabled {
                self.start().await?;
            }
        }

        Ok(())
    }

    pub fn get_config(&self) -> MultiviewerConfig {
        self.config.lock().unwrap().clone()
    }

    // Convert vMix inputs to multiviewer data with layer information
    async fn convert_vmix_inputs_to_multiviewer_data(
        app_state: &crate::state::AppState,
        connection: &crate::types::VmixConnection,
        selected_input_key: &str
    ) -> MultiviewerData {
        let mut multiviewer_inputs = Vec::new();
        
        // Get the HTTP client for this connection to fetch detailed layer data
        let vmix_client = {
            let http_connections = app_state.http_connections.lock().unwrap();
            http_connections.iter().find(|c| c.host() == connection.host).cloned()
        };
        
        if let Some(client) = vmix_client {
            // Get raw vMix XML state for layer information
            match client.get_raw_vmix_state().await {
                Ok(vmix_state) => {
                    app_log!(info, "Successfully retrieved vMix state with {} inputs", vmix_state.inputs.input.len());
                    app_log!(info, "Looking for input with key: {}", selected_input_key);
                    
                    // Debug: List all available inputs
                    for (i, inp) in vmix_state.inputs.input.iter().enumerate() {
                        app_log!(info, "Input {}: key={}, title={}, overlays={}", i+1, inp.key, inp.title, inp.overlay.len());
                    }
                    
                    // Find the selected input and extract its layers
                    if let Some(selected_input) = vmix_state.inputs.input.iter().find(|inp| inp.key == selected_input_key) {
                        let overlay_count = selected_input.overlay.len();
                        app_log!(info, "Found selected input: {} with {} overlays", selected_input.title, overlay_count);
                        
                        // Debug: Print raw overlay information
                        for (i, overlay) in selected_input.overlay.iter().enumerate() {
                            app_log!(info, "Raw overlay {}: index={}, key={}", i, overlay.index, overlay.key);
                            if let Some(position) = &overlay.position {
                                app_log!(info, "  Position: x={:?}, y={:?}, width={:?}, height={:?}", 
                                    position.x, position.y, position.width, position.height);
                                app_log!(info, "  Pan/Zoom: pan_x={:?}, pan_y={:?}, zoom_x={:?}, zoom_y={:?}", 
                                    position.pan_x, position.pan_y, position.zoom_x, position.zoom_y);
                            } else {
                                app_log!(info, "  No position data");
                            }
                        }
                        
                        let layers: Vec<MultiviewerLayer> = selected_input.overlay.iter().map(|overlay| {
                            // Parse overlay positions from position field
                            let (x, y, width, height, zorder, panx, pany, zoom) = if let Some(position) = &overlay.position {
                                (
                                    position.x.as_ref().and_then(|x| x.parse::<f64>().ok()).unwrap_or(0.0),
                                    position.y.as_ref().and_then(|y| y.parse::<f64>().ok()).unwrap_or(0.0),
                                    position.width.as_ref().and_then(|w| w.parse::<f64>().ok()).unwrap_or(1920.0),
                                    position.height.as_ref().and_then(|h| h.parse::<f64>().ok()).unwrap_or(1080.0),
                                    0, // zorder not available in vmix-rs Position
                                    position.pan_x.as_ref().and_then(|px| px.parse::<f64>().ok()).unwrap_or(0.0),
                                    position.pan_y.as_ref().and_then(|py| py.parse::<f64>().ok()).unwrap_or(0.0),
                                    position.zoom_x.as_ref().and_then(|z| z.parse::<f64>().ok()).unwrap_or(1.0),
                                )
                            } else {
                                (0.0, 0.0, 1920.0, 1080.0, 0, 0.0, 0.0, 1.0)
                            };
                            
                            let index = overlay.index.parse::<i32>().unwrap_or(0);
                            
                            // Find the input that corresponds to this layer
                            let (layer_input_key, layer_input_name) = if index > 0 && (index as usize) <= vmix_state.inputs.input.len() {
                                let layer_input = &vmix_state.inputs.input[(index - 1) as usize];
                                (layer_input.key.clone(), layer_input.title.clone())
                            } else if !overlay.key.is_empty() {
                                // Use the overlay's key to find the corresponding input
                                if let Some(key_input) = vmix_state.inputs.input.iter().find(|inp| inp.key == overlay.key) {
                                    (key_input.key.clone(), key_input.title.clone())
                                } else {
                                    (overlay.key.clone(), format!("Input {}", overlay.key))
                                }
                            } else {
                                ("unknown".to_string(), "Unknown Layer".to_string())
                            };
                            
                            MultiviewerLayer {
                                index,
                                x,
                                y,
                                width,
                                height,
                                crop: None, // Not available in vmix-rs
                                zorder,
                                panx,
                                pany,
                                zoom,
                                input_key: layer_input_key,
                                input_name: layer_input_name,
                            }
                        }).collect();
                        
                        multiviewer_inputs.push(MultiviewerInput {
                            key: selected_input.key.clone(),
                            number: selected_input.number.parse().unwrap_or(0),
                            name: selected_input.title.clone(),
                            state: match selected_input.state {
                                vmix_rs::models::State::Running => "Running".to_string(),
                                vmix_rs::models::State::Paused => "Paused".to_string(),
                                vmix_rs::models::State::Completed => "Completed".to_string(),
                            },
                            layers,
                        });
                        
                        app_log!(info, "Processed multiviewer input '{}' with {} layers", selected_input.title, multiviewer_inputs[0].layers.len());
                        
                        // Debug: Print processed layer information
                        for (i, layer) in multiviewer_inputs[0].layers.iter().enumerate() {
                            app_log!(info, "Processed layer {}: index={}, input_name={}", i, layer.index, layer.input_name);
                            app_log!(info, "  Position: x={}, y={}, width={}, height={}", layer.x, layer.y, layer.width, layer.height);
                            app_log!(info, "  Pan/Zoom: panx={}, pany={}, zoom={}, zorder={}", layer.panx, layer.pany, layer.zoom, layer.zorder);
                            app_log!(info, "  Input key: {}", layer.input_key);
                        }
                    }
                }
                Err(e) => {
                    app_log!(error, "Failed to get vMix state for multiviewer: {}", e);
                }
            }
        }
        
        // Fallback: create empty data if no layers found
        if multiviewer_inputs.is_empty() {
            let inputs_cache = app_state.inputs_cache.lock().unwrap();
            if let Some(cached_inputs) = inputs_cache.get(&connection.host) {
                if let Some(cached_input) = cached_inputs.iter().find(|inp| inp.key == selected_input_key) {
                    multiviewer_inputs.push(MultiviewerInput {
                        key: cached_input.key.clone(),
                        number: cached_input.number,
                        name: cached_input.title.clone(),
                        state: cached_input.state.clone(),
                        layers: Vec::new(), // No layers available
                    });
                }
            }
        }

        MultiviewerData {
            inputs: multiviewer_inputs,
            active_input: Some(connection.active_input),
            preview_input: Some(connection.preview_input),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        }
    }

    // Create empty multiviewer data
    fn create_empty_multiviewer_data() -> MultiviewerData {
        MultiviewerData {
            inputs: vec![],
            active_input: None,
            preview_input: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        }
    }

    // Get current multiviewer data from app state with layer information
    async fn get_current_multiviewer_data(app_state: &crate::state::AppState, config: &MultiviewerConfig, selected_input_key: &str) -> MultiviewerData {
        app_log!(debug, "Getting multiviewer data for config: {:?}, input key: {}", config.selected_connection, selected_input_key);
        
        if let Some(ref selected_connection) = config.selected_connection {
            // Parse host:port format
            let host = if selected_connection.contains(':') {
                selected_connection.split(':').next().unwrap_or(selected_connection)
            } else {
                selected_connection
            };
            app_log!(debug, "Parsed host from connection '{}': '{}'", selected_connection, host);

            // Try to get vMix data from the selected connection
            let connections = app_state.get_connections();
            app_log!(debug, "Available connections: {:?}", connections.iter().map(|c| &c.host).collect::<Vec<_>>());
            
            if let Some(connection) = connections.iter().find(|c| c.host == host) {
                app_log!(debug, "Found matching connection for host: {}", host);
                // Use the new async version with layer support
                let result = Self::convert_vmix_inputs_to_multiviewer_data(app_state, connection, selected_input_key).await;
                app_log!(debug, "Converted to {} multiviewer inputs", result.inputs.len());
                result
            } else {
                app_log!(warn, "Connection not found for host: {}", host);
                Self::create_empty_multiviewer_data()
            }
        } else {
            app_log!(warn, "No connection selected in multiviewer config");
            Self::create_empty_multiviewer_data()
        }
    }

    // Axum handlers
    async fn serve_multiviewer_page(
        Query(params): Query<HashMap<String, String>>,
        axum::extract::State(state): axum::extract::State<Arc<Self>>
    ) -> Html<String> {
        let mut html = include_str!("../multiviewer/index.html").to_string();
        
        // Inject query parameters into the HTML and update config
        if let (Some(connection), Some(input)) = (params.get("connection"), params.get("input")) {
            app_log!(info, "Serving multiviewer page for connection: {}, input: {}", connection, input);
            
            // Update the multiviewer config to match the URL parameters
            {
                let mut config_guard = state.config.lock().unwrap();
                config_guard.selected_connection = Some(connection.clone());
            }
            
            let script_injection = format!(
                r#"<script>
                    console.log('Injecting multiviewer params:', '{}', '{}');
                    window.multiviewerParams = {{
                        connection: "{}",
                        input: "{}"
                    }};
                </script>"#,
                connection, input, connection, input
            );
            
            // Insert the script before the closing </head> tag
            html = html.replace("</head>", &format!("{}</head>", script_injection));
            app_log!(debug, "Injected script into HTML for connection: {}, input: {}", connection, input);
        } else {
            app_log!(warn, "No connection or input parameters provided in URL: {:?}", params);
        }
        
        Html(html)
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

    async fn get_multiviewer_layers(
        Query(params): Query<HashMap<String, String>>,
        axum::extract::State(state): axum::extract::State<Arc<Self>>
    ) -> axum::Json<MultiviewerData> {
        let mut config = state.get_config();
        
        if let (Some(connection), Some(input_key)) = (params.get("connection"), params.get("input")) {
            app_log!(debug, "Getting layer data for connection: {}, input: {}", connection, input_key);
            
            // Update the config with the requested connection if different
            if config.selected_connection.as_ref() != Some(connection) {
                let mut config_guard = state.config.lock().unwrap();
                config_guard.selected_connection = Some(connection.clone());
                config.selected_connection = Some(connection.clone());
            }
            
            let layer_data = Self::get_current_multiviewer_data(&state.app_state, &config, input_key).await;
            app_log!(debug, "Returning layer data with {} inputs", layer_data.inputs.len());
            axum::Json(layer_data)
        } else {
            app_log!(warn, "Missing connection or input parameters for layer request");
            axum::Json(Self::create_empty_multiviewer_data())
        }
    }

    async fn get_config_handler(
        axum::extract::State(state): axum::extract::State<Arc<Self>>
    ) -> axum::Json<MultiviewerConfig> {
        let config = state.get_config();
        app_log!(debug, "Returning multiviewer config: enabled={}, port={}", config.enabled, config.port);
        axum::Json(config)
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

        // Send actual current data instead of empty initial data  
        let _config = state.get_config();
        // For initial data, we need to know the selected input key - we'll extract it from the URL when possible
        // For now, send empty data and rely on the frontend to send specific input requests
        let initial_data = Self::create_empty_multiviewer_data();
        app_log!(debug, "Sending initial WebSocket data with {} inputs", initial_data.inputs.len());

        if let Err(e) = socket.send(Message::Text(serde_json::to_string(&initial_data).unwrap())).await {
            app_log!(error, "Failed to send initial data: {}", e);
            return;
        }

        // Listen for broadcast messages
        while let Ok(data) = rx.recv().await {
            app_log!(debug, "Broadcasting WebSocket data with {} inputs", data.inputs.len());
            if let Err(e) = socket.send(Message::Text(serde_json::to_string(&data).unwrap())).await {
                app_log!(error, "Failed to send WebSocket message: {}", e);
                break;
            }
        }
    }
}

unsafe impl Send for MultiviewerServer {}
unsafe impl Sync for MultiviewerServer {}
