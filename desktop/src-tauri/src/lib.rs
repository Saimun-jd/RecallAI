use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use argon2::Argon2;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      if let Ok(sidecar_command) = app.shell().sidecar("recall-backend") {
        match sidecar_command.spawn() {
            Ok((mut rx, _child)) => {
                tauri::async_runtime::spawn(async move {
                    while let Some(event) = rx.recv().await {
                        if let CommandEvent::Stdout(line) = event {
                            println!("sidecar: {}", String::from_utf8_lossy(&line));
                        } else if let CommandEvent::Stderr(line) = event {
                            println!("sidecar error: {}", String::from_utf8_lossy(&line));
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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
