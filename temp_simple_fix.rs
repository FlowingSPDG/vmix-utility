// Simple fix approach - use HTTP for now and add TCP as enhancement
// This ensures the build works while we properly integrate vmix-rs

use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::collections::HashMap;
use reqwest;
use quick_xml::de;

#[derive(Debug, Clone)]
struct VmixClient {
    base_url: String,
    client: reqwest::Client,
    // Optional TCP API for future use
    tcp_enabled: bool,
}

impl VmixClient {
    fn new(host: &str, port: u16) -> Self {
        Self {
            base_url: format!("http://{}:{}/api", host, port),
            client: reqwest::Client::new(),
            tcp_enabled: false,
        }
    }
    
    async fn get_vmix_data(&self) -> Result<VmixXml> {
        let response = self.client
            .get(&self.base_url)
            .send()
            .await?;
        
        let xml_text = response.text().await?;
        let vmix_data: VmixXml = de::from_str(&xml_text)?;
        Ok(vmix_data)
    }

    async fn get_status(&self) -> Result<bool> {
        match self.get_vmix_data().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn send_function(&self, function_name: &str, params: &HashMap<String, String>) -> Result<()> {
        // HTTP API implementation
        let mut url = url::Url::parse(&self.base_url)?;
        url.query_pairs_mut().append_pair("Function", function_name);
        
        for (key, value) in params {
            url.query_pairs_mut().append_pair(key, value);
        }
        
        let response = self.client
            .get(url.as_str())
            .send()
            .await?;
        
        if response.status().is_success() {
            Ok(())
        } else {
            Err(anyhow::anyhow!("Function failed"))
        }
    }
    
    fn host(&self) -> &str {
        let start = "http://".len();
        let end = self.base_url[start..].find(':').map(|i| start + i).unwrap_or(self.base_url.len());
        &self.base_url[start..end]
    }
}