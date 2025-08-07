// Quick test of HTTP implementation
use std::io::Write;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Testing vMix HTTP connection to 192.168.1.6:8088");
    
    let client = reqwest::Client::new();
    let response = client
        .get("http://192.168.1.6:8088/api")
        .send()
        .await?;
    
    if response.status().is_success() {
        println!("✅ HTTP connection successful!");
        let text = response.text().await?;
        println!("XML length: {} characters", text.len());
        
        // Try to parse with quick-xml
        match quick_xml::de::from_str::<serde_json::Value>(&text) {
            Ok(_) => println!("✅ XML parsing would work"),
            Err(e) => println!("⚠️  XML parsing needs adjustment: {}", e),
        }
    } else {
        println!("❌ HTTP connection failed: {}", response.status());
    }
    
    Ok(())
}