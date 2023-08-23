use crate::registry_logger::Logger;
use anyhow::{anyhow, Result};
use sha2::Digest;
use sha2::Sha256;
use std::env;
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;
use tokio::task;

#[derive(Debug, Clone)]
pub struct HiveRegistry {
    endpoint: String,
    key: String,
    file_name: String,
    etag: Option<String>,
    accept_invalid_certs: bool,
    pub logger: Logger,
}

pub struct HiveRegistryConfig {
    endpoint: Option<String>,
    key: Option<String>,
    poll_interval: Option<u64>,
    accept_invalid_certs: Option<bool>,
}

impl Default for HiveRegistryConfig {
    fn default() -> Self {
        HiveRegistryConfig {
            endpoint: None,
            key: None,
            poll_interval: None,
            accept_invalid_certs: Some(true),
        }
    }
}

static COMMIT: Option<&'static str> = option_env!("GITHUB_SHA");

impl HiveRegistry {
    pub async fn new(user_config: Option<HiveRegistryConfig>) -> Result<()> {
        let mut config = user_config.unwrap_or_default();

        // Pass values from environment variables if they are not set in the user's config
        config.endpoint = config
            .endpoint
            .or_else(|| env::var("HIVE_CDN_ENDPOINT").ok());
        config.key = config.key.or_else(|| env::var("HIVE_CDN_KEY").ok());

        config.poll_interval = config.poll_interval.or_else(|| {
            env::var("HIVE_CDN_POLL_INTERVAL")
                .ok()
                .and_then(|s| s.parse().ok())
                .or_else(|| panic!("failed to parse HIVE_CDN_POLL_INTERVAL"))
        });

        config.accept_invalid_certs = config.accept_invalid_certs.or_else(|| {
            env::var("HIVE_CDN_ACCEPT_INVALID_CERTS")
                .ok()
                .map(|s| s == "1" || s.to_lowercase() == "true" || s.to_lowercase() == "on")
        });

        // Resolve values
        let endpoint = config.endpoint.unwrap_or_else(|| "".to_string());
        let key = config.key.unwrap_or_else(|| "".to_string());
        let poll_interval = config.poll_interval.unwrap_or(10);
        let accept_invalid_certs = config.accept_invalid_certs.unwrap_or(false);

        let logger = Logger::new();

        match (endpoint.is_empty(), key.is_empty()) {
            (_empty_endpoint @ true, _empty_key @ true) => {
                // don't start the polling and skip the registry
                logger.info("You're not using GraphQL Hive as the source of schema.");
                logger.info("Reason: could not find HIVE_CDN_KEY and HIVE_CDN_ENDPOINT environment variables.");
                return Ok(());
            }
            (_endpoint_empty @ true, _) => {
                return Err(anyhow!("environment variable HIVE_CDN_ENDPOINT not found"));
            }
            (_, _key_empty @ true) => {
                return Err(anyhow!("environment variable HIVE_CDN_KEY not found"));
            }
            _ => {}
        }

        // A hacky way to force the router to use GraphQL Hive CDN as the source of schema.
        // Our plugin does the polling and saves the supergraph to a file.
        // It also enables hot-reloading to makes sure Apollo Router watches the file.
        let file_name = "supergraph-schema.graphql".to_string();
        env::set_var("APOLLO_ROUTER_SUPERGRAPH_PATH", file_name.clone());
        env::set_var("APOLLO_ROUTER_HOT_RELOAD", "true");

        let mut registry = HiveRegistry {
            endpoint,
            key,
            file_name,
            etag: None,
            accept_invalid_certs,
            logger,
        };

        match registry.initial_supergraph().await {
            Ok(_) => {
                registry
                    .logger
                    .info("Successfully fetched and saved supergraph from GraphQL Hive");
            }
            Err(e) => {
                registry.logger.error(&e);
                std::process::exit(1);
            }
        }

        task::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(poll_interval)).await;
                registry.poll().await;
            }
        });

        Ok(())
    }

    async fn fetch_supergraph(&mut self, etag: Option<String>) -> Result<Option<String>, String> {
        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(self.accept_invalid_certs)
            .build()
            .map_err(|err| err.to_string())?;
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
            .await
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

        Ok(Some(resp.text().await.map_err(|e| e.to_string())?))
    }

    async fn initial_supergraph(&mut self) -> Result<(), String> {
        // Using async File create and write_all
        let mut file = File::create(self.file_name.clone())
            .await
            .map_err(|e| e.to_string())?;
        let resp = self.fetch_supergraph(None).await?;

        match resp {
            Some(supergraph) => {
                file.write_all(supergraph.as_bytes())
                    .await
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

    async fn poll(&mut self) {
        match self.fetch_supergraph(self.etag.clone()).await {
            Ok(new_supergraph) => {
                if let Some(new_supergraph) = new_supergraph {
                    // Changes to use async read_to_string and write
                    let current_file = fs::read_to_string(self.file_name.clone())
                        .await
                        .expect("Could not read file");
                    let current_supergraph_hash = hash(current_file.as_bytes());

                    let new_supergraph_hash = hash(new_supergraph.as_bytes());

                    if current_supergraph_hash != new_supergraph_hash {
                        self.logger.info("New supergraph detected!");
                        fs::write(self.file_name.clone(), new_supergraph)
                            .await
                            .expect("Could not write file");
                    }
                }
            }
            Err(e) => self.logger.error(&format!("{}", e)),
        }
    }
}

fn hash(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:X}", hasher.finalize())
}
