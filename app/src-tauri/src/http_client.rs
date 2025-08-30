use crate::types::{VmixXml, Input, Inputs};
use crate::app_log;
use anyhow::Result;
use std::collections::HashMap;
use std::time::Duration;
use vmix_rs::http::HttpVmixClient;

// HTTP Wrapper for HttpVmixClient to include host information
#[derive(Debug, Clone)]
pub struct VmixClientWrapper {
    client: HttpVmixClient,
    host: String,
    port: u16,
}

// Ensure VmixClientWrapper is Send and Sync
unsafe impl Send for VmixClientWrapper {}
unsafe impl Sync for VmixClientWrapper {}

impl VmixClientWrapper {
    pub fn new(host: &str, port: u16) -> Self {
        let client = HttpVmixClient::new_with_host_port(host, port, Duration::from_secs(10));
        Self {
            client,
            host: host.to_string(),
            port,
        }
    }

    pub async fn get_status(&self) -> Result<bool> {
        Ok(self.client.is_connected().await)
    }

    pub async fn get_active_input(&self) -> Result<i32> {
        let active = self.client.get_active_input().await?;
        Ok(active as i32)
    }

    pub async fn get_preview_input(&self) -> Result<i32> {
        let preview = self.client.get_preview_input().await?;
        Ok(preview as i32)
    }

    pub async fn send_function(&self, function_name: &str, params: &HashMap<String, String>) -> Result<()> {
        app_log!(info, "Sending vMix function: {} to {} with params: {:?}", function_name, self.host(), params);
        
        self.client.execute_function(function_name, params).await?;
        
        app_log!(info, "Successfully sent vMix function: {} to {}", function_name, self.host());
        Ok(())
    }

    pub async fn get_vmix_data(&self) -> Result<VmixXml> {
        let vmix_state = self.client.get_xml_state().await?;
        // Convert vmix-rs Vmix struct to our VmixXml format
        Ok(VmixXml {
            version: vmix_state.version,
            edition: vmix_state.edition,
            preset: Some(vmix_state.preset),
            inputs: Inputs {
                input: vmix_state.inputs.input.into_iter().map(|input| Input {
                    key: input.key,
                    number: input.number.to_string(),
                    title: input.title.clone(),
                    short_title: Some(input.short_title),
                    input_type: Some(input.input_type),
                    state: Some(match input.state {
                        vmix_rs::models::State::Running => "Running".to_string(),
                        vmix_rs::models::State::Paused => "Paused".to_string(),
                        vmix_rs::models::State::Completed => "Completed".to_string(),
                    }),
                    overlays: input.overlay.into_iter().map(|overlay| crate::types::InputOverlay {
                        index: overlay.index.to_string(),
                        x: overlay.position.as_ref().and_then(|p| p.x.as_ref()).and_then(|x| x.parse().ok()).unwrap_or(0.0),
                        y: overlay.position.as_ref().and_then(|p| p.y.as_ref()).and_then(|y| y.parse().ok()).unwrap_or(0.0),
                        width: overlay.position.as_ref().and_then(|p| p.width.as_ref()).and_then(|w| w.parse().ok()).unwrap_or(0.0),
                        height: overlay.position.as_ref().and_then(|p| p.height.as_ref()).and_then(|h| h.parse().ok()).unwrap_or(0.0),
                        crop: false, // Default value
                        zorder: 0, // Default value
                        panx: overlay.position.as_ref().and_then(|p| p.pan_x.as_ref()).and_then(|px| px.parse().ok()).unwrap_or(0.0),
                        pany: overlay.position.as_ref().and_then(|p| p.pan_y.as_ref()).and_then(|py| py.parse().ok()).unwrap_or(0.0),
                        zoom: overlay.position.as_ref().and_then(|p| p.zoom_x.as_ref()).and_then(|z| z.parse().ok()).unwrap_or(1.0),
                    }).collect(),
                }).collect(),
            },
            active: Some(vmix_state.active),
            preview: Some(vmix_state.preview),
        })
    }

    // Get raw vmix-rs state for VideoList processing
    pub async fn get_raw_vmix_state(&self) -> Result<vmix_rs::models::Vmix> {
        self.client.get_xml_state().await
    }

    // Get raw XML string for debugging
    pub async fn get_raw_xml(&self) -> Result<String> {
        let url = format!("http://{}:{}/api", self.host, self.port);
        let response = reqwest::get(&url).await?;
        let xml_text = response.text().await?;
        Ok(xml_text)
    }

    pub fn host(&self) -> &str {
        &self.host
    }
    
    pub fn port(&self) -> u16 {
        self.port
    }
}