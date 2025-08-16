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
    // First check if environment variable is set (used by GitHub Actions)
    if let Ok(branch) = std::env::var("GIT_BRANCH") {
        return branch;
    }
    
    // Fallback to git command
    match Command::new("git")
        .args(&["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
                // If we get HEAD (detached state), try to get the tag name instead
                if branch == "HEAD" {
                    if let Ok(tag_output) = Command::new("git")
                        .args(&["describe", "--tags", "--exact-match", "HEAD"])
                        .output()
                    {
                        if tag_output.status.success() {
                            return format!("tag: {}", String::from_utf8_lossy(&tag_output.stdout).trim());
                        }
                    }
                }
                branch
            } else {
                "unknown".to_string()
            }
        }
        Err(_) => "unknown".to_string(),
    }
}
