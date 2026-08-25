use std::sync::Mutex;
use tauri::{Manager, Emitter};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_deep_link::DeepLinkExt;

struct SidecarState(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let _ = app.emit("deep-link-urls", args);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init());

    let app = builder
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                let _ = app.deep_link().register_all();
            }

            // Generate or load a random salt for Stronghold
            let data_dir = app.path().app_local_data_dir().expect("Failed to get local data dir");
            std::fs::create_dir_all(&data_dir).expect("Failed to create data dir");
            let salt_path = data_dir.join("salt.bin");

            let salt: [u8; 16] = if salt_path.exists() {
                let mut buf = [0u8; 16];
                let data = std::fs::read(&salt_path).expect("Failed to read salt");
                buf.copy_from_slice(&data[..16]);
                buf
            } else {
                let s: [u8; 16] = rand::random();
                std::fs::write(&salt_path, s).expect("Failed to write salt");
                s
            };

            app.handle().plugin(
                tauri_plugin_stronghold::Builder::new(move |password| {
                    let argon2 = argon2::Argon2::default();
                    let mut key = vec![0u8; 32];
                    argon2
                        .hash_password_into(password.as_bytes(), &salt, &mut key)
                        .expect("failed to hash password");
                    key
                })
                .build(),
            ).expect("Failed to initialize stronghold");
            
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
