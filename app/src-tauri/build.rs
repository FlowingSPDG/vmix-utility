use std::process::Command;

fn main() {
    // Get Git commit hash at build time
    let git_hash = get_git_commit_hash();
    println!("cargo:rustc-env=GIT_COMMIT_HASH={}", git_hash);
    
    // Get Git branch at build time
    let git_branch = get_git_branch();
    println!("cargo:rustc-env=GIT_BRANCH={}", git_branch);
    
    // Get build timestamp
    let build_time = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();
    println!("cargo:rustc-env=BUILD_TIMESTAMP={}", build_time);
    
    tauri_build::build()
}

fn get_git_commit_hash() -> String {
    match Command::new("git")
        .args(&["rev-parse", "--short", "HEAD"])
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            } else {
                "unknown".to_string()
            }
        }
        Err(_) => "unknown".to_string(),
    }
}

fn get_git_branch() -> String {
    match Command::new("git")
        .args(&["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            } else {
                "unknown".to_string()
            }
        }
        Err(_) => "unknown".to_string(),
    }
}
