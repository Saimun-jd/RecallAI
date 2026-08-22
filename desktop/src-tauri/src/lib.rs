use tauri_plugin_shell::process::{CommandEvent, CommandChild};
use tauri_plugin_shell::ShellExt;
use tauri::Manager;
use std::sync::Mutex;

struct SidecarState(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_stronghold::Builder::new(|password| {
            let salt = b"recall-static-salt-v1"; // see note below
            let argon2 = argon2::Argon2::default();
            let mut key = vec![0u8; 32];
            argon2
                .hash_password_into(password.as_bytes(), salt, &mut key)
                .expect("failed to hash password");
            key
        }).build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init());

    let app = builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            if let Ok(sidecar_command) = app.shell().sidecar("recall-backend") {
                // Ensure no zombie backend processes are hogging port 8000 before spawning
                #[cfg(target_os = "windows")]
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/IM", "recall-backend.exe"])
                    .output();
                    
                match sidecar_command.spawn() {
                    Ok((mut rx, child)) => {
                        app.manage(SidecarState(Mutex::new(Some(child))));
                        tauri::async_runtime::spawn(async move {
                            while let Some(event) = rx.recv().await {
                                if let CommandEvent::Stdout(line) = event {
                                    println!("[BACKEND STDOUT] {}", String::from_utf8_lossy(&line));
                                } else if let CommandEvent::Stderr(line) = event {
                                    println!("[BACKEND STDERR] {}", String::from_utf8_lossy(&line));
                                }
                            }
                        });
                    }
                    Err(e) => {
                        println!("Warning: Failed to spawn sidecar binary (dev mode). Ensure uvicorn is running manually. Error: {}", e);
                    }
                }
            } else {
                println!("Warning: recall-backend sidecar config not found.");
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<SidecarState>() {
                if let Ok(mut child_lock) = state.0.lock() {
                    if let Some(child) = child_lock.take() {
                        println!("Killing sidecar process...");
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}
