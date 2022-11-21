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
    etag: Option<String>,
}

static COMMIT: Option<&'static str> = option_env!("GITHUB_SHA");

impl HiveRegistry {
    pub fn new() -> Result<(), String> {
        let endpoint = env::var("HIVE_CDN_ENDPOINT").unwrap_or_default();
        let key = env::var("HIVE_CDN_KEY").unwrap_or_default();

        //.map_err(|_| "environment variable HIVE_CDN_KEY not found")?;
        // .map_err(|_| "environment variable HIVE_CDN_ENDPOINT not found")?;
        if endpoint.is_empty() && key.is_empty() {
            tracing::info!("You're not using GraphQL Hive as the source of schema.");
            tracing::info!(
                "Reason: could not find HIVE_CDN_KEY and HIVE_CDN_ENDPOINT environment variables."
            );
            return Ok(());
        }

        if endpoint.is_empty() {
            return Err("environment variable HIVE_CDN_ENDPOINT not found".to_string());
        }

        if key.is_empty() {
            return Err("environment variable HIVE_CDN_KEY not found".to_string());
        }

        let file_name = "supergraph-schema.graphql".to_string();
        let poll_interval: u64 = env::var("HIVE_CDN_POLL_INTERVAL")
            .unwrap_or_else(|_| "10".to_string())
            .parse()
            .expect("failed to parse HIVE_CDN_POLL_INTERVAL");

        env::set_var("APOLLO_ROUTER_SUPERGRAPH_PATH", file_name.clone());
        env::set_var("APOLLO_ROUTER_HOT_RELOAD", "true");

        let mut registry = HiveRegistry {
            endpoint,
            key,
            file_name,
            etag: None,
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
            thread::sleep(std::time::Duration::from_secs(poll_interval));
            registry.poll()
        });

        Ok(())
    }

    fn fetch_supergraph(&mut self, etag: Option<String>) -> Result<Option<String>, String> {
        let client = reqwest::blocking::Client::new();
        let mut headers = reqwest::header::HeaderMap::new();

        headers.insert(
            reqwest::header::USER_AGENT,
            reqwest::header::HeaderValue::from_str(
                format!("hive-apollo-router/{}", COMMIT.unwrap_or_else(|| "local")).as_str(),
            )
            .unwrap(),
        );
        headers.insert("X-Hive-CDN-Key", self.key.parse().unwrap());

        if let Some(checksum) = etag {
            headers.insert("If-None-Match", checksum.parse().unwrap());
        }

        let resp = client
            .get(format!("{}/supergraph", self.endpoint))
            .headers(headers)
            .send()
            .map_err(|e| e.to_string())?;

        match resp.headers().get("etag") {
            Some(checksum) => {
                let etag = checksum.to_str().map_err(|e| e.to_string())?;
                self.update_latest_etag(Some(etag.to_string()));
            }
            None => {
                self.update_latest_etag(None);
            }
        }

        if resp.status().as_u16() == 304 {
            return Ok(None);
        }

        Ok(Some(resp.text().map_err(|e| e.to_string())?))
    }

    fn initial_supergraph(&mut self) -> Result<(), String> {
        let mut file = std::fs::File::create(self.file_name.clone()).map_err(|e| e.to_string())?;
        let resp = self.fetch_supergraph(None)?;

        match resp {
            Some(supergraph) => {
                file.write_all(supergraph.as_bytes())
                    .map_err(|e| e.to_string())?;
            }
            None => {
                return Err("Failed to fetch supergraph".to_string());
            }
        }

        Ok(())
    }

    fn update_latest_etag(&mut self, etag: Option<String>) {
        self.etag = etag;
    }

    fn poll(&mut self) {
        match self.fetch_supergraph(self.etag.clone()) {
            Ok(new_supergraph) => {
                if let Some(new_supergraph) = new_supergraph {
                    let current_file = std::fs::read_to_string(self.file_name.clone())
                        .expect("Could not read file");
                    let current_supergraph_hash = hash(current_file.as_bytes());

                    let new_supergraph_hash = hash(new_supergraph.as_bytes());

                    if current_supergraph_hash != new_supergraph_hash {
                        tracing::info!("New supergraph detected!");
                        std::fs::write(self.file_name.clone(), new_supergraph)
                            .expect("Could not write file");
                    }
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
