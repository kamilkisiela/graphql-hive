use anyhow::Result;
use sha2::Digest;
use sha2::Sha256;
use std::env;
use std::io::Write;
use std::thread;

#[derive(Debug, Clone)]
pub struct HiveRegistry {
    endpoint: String,
    key: String,
    file_name: String,
}

impl HiveRegistry {
    pub fn new() -> Result<(), String> {
        let endpoint = env::var("HIVE_CDN_ENDPOINT").map_err(|e| e.to_string())?;
        let key = env::var("HIVE_CDN_KEY").map_err(|e| e.to_string())?;
        let file_name = "supergraph-schema.graphql".to_string();

        env::set_var("APOLLO_ROUTER_SUPERGRAPH_PATH", file_name.clone());
        env::set_var("APOLLO_ROUTER_HOT_RELOAD", "true");

        let registry = HiveRegistry {
            endpoint,
            key,
            file_name,
        };

        match registry.initial_supergraph() {
            Ok(_) => {
                tracing::info!("Successfully fetched and saved supergraph");
            }
            Err(e) => {
                eprintln!("{}", e);
                std::process::exit(1);
            }
        }

        thread::spawn(move || loop {
            thread::sleep(std::time::Duration::from_secs(10));
            registry.poll()
        });

        Ok(())
    }

    fn fetch_supergraph(&self) -> Result<String, String> {
        let client = reqwest::blocking::Client::new();
        let resp = client
            .get(format!("{}/supergraph", self.endpoint))
            .header("X-Hive-CDN-Key", self.key.to_string())
            .send()
            .map_err(|e| e.to_string())?;

        Ok(resp.text().map_err(|e| e.to_string())?)
    }

    fn initial_supergraph(&self) -> Result<(), String> {
        let mut file = std::fs::File::create(self.file_name.clone()).map_err(|e| e.to_string())?;
        let resp = self.fetch_supergraph()?;
        file.write_all(resp.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn poll(&self) {
        let current_file =
            std::fs::read_to_string(self.file_name.clone()).expect("Could not read file");
        let current_supergraph_hash = hash(current_file.as_bytes());

        match self.fetch_supergraph() {
            Ok(new_supergraph) => {
                let new_supergraph_hash = hash(new_supergraph.as_bytes());
                if current_supergraph_hash != new_supergraph_hash {
                    tracing::info!("New supergraph detected!");
                    std::fs::write(self.file_name.clone(), new_supergraph)
                        .expect("Could not write file");
                }
            }
            Err(e) => tracing::error!("{}", e),
        }
    }
}

fn hash(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:X}", hasher.finalize())
}
