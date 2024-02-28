use crate::registry_logger::Logger;
use anyhow::{anyhow, Result};
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
    accept_invalid_certs: bool,
    pub logger: Logger,
}

pub struct HiveRegistryConfig {
    endpoint: Option<String>,
    key: Option<String>,
    poll_interval: Option<u64>,
    accept_invalid_certs: Option<bool>,
    schema_file_path: Option<String>,
}

static COMMIT: Option<&'static str> = option_env!("GITHUB_SHA");

impl HiveRegistry {
    pub fn new(user_config: Option<HiveRegistryConfig>) -> Result<()> {
        let mut config = HiveRegistryConfig {
            endpoint: None,
            key: None,
            poll_interval: None,
            accept_invalid_certs: Some(true),
            schema_file_path: None
        };

        // Pass values from user's config
        if let Some(user_config) = user_config {
            config.endpoint = user_config.endpoint;
            config.key = user_config.key;
            config.poll_interval = user_config.poll_interval;
            config.accept_invalid_certs = user_config.accept_invalid_certs;
            config.schema_file_path = user_config.schema_file_path;
        }

        // Pass values from environment variables if they are not set in the user's config

        if config.endpoint.is_none() {
            if let Ok(endpoint) = env::var("HIVE_CDN_ENDPOINT") {
                config.endpoint = Some(endpoint);
            }
        }

        if config.key.is_none() {
            if let Ok(key) = env::var("HIVE_CDN_KEY") {
                config.key = Some(key);
            }
        }

        if config.poll_interval.is_none() {
            if let Ok(poll_interval) = env::var("HIVE_CDN_POLL_INTERVAL") {
                config.poll_interval = Some(
                    poll_interval
                        .parse()
                        .expect("failed to parse HIVE_CDN_POLL_INTERVAL"),
                );
            }
        }

        if config.accept_invalid_certs.is_none() {
            if let Ok(accept_invalid_certs) = env::var("HIVE_CDN_ACCEPT_INVALID_CERTS") {
                config.accept_invalid_certs = Some(
                    accept_invalid_certs.eq("1")
                        || accept_invalid_certs.to_lowercase().eq("true")
                        || accept_invalid_certs.to_lowercase().eq("on"),
                );
            }
        }

        if config.schema_file_path.is_none() {
            if let Ok(schema_file_path) = env::var("HIVE_CDN_SCHEMA_FILE_PATH") {
                config.schema_file_path = Some(schema_file_path);
            }
        }

        // Resolve values
        let endpoint = config.endpoint.unwrap_or_else(|| "".to_string());
        let key = config.key.unwrap_or_else(|| "".to_string());
        let poll_interval: u64 = match config.poll_interval {
            Some(value) => value,
            None => 10,
        };
        let accept_invalid_certs = config.accept_invalid_certs.unwrap_or_else(|| false);

        let logger = Logger::new();

        // In case of an endpoint and an key being empty, we don't start the polling and skip the registry
        if endpoint.is_empty() && key.is_empty() {
            logger.info("You're not using GraphQL Hive as the source of schema.");
            logger.info(
                "Reason: could not find HIVE_CDN_KEY and HIVE_CDN_ENDPOINT environment variables.",
            );
            return Ok(());
        }

        // Throw if endpoint is empty
        if endpoint.is_empty() {
            return Err(anyhow!("environment variable HIVE_CDN_ENDPOINT not found",));
        }

        // Throw if key is empty
        if key.is_empty() {
            return Err(anyhow!("environment variable HIVE_CDN_KEY not found"));
        }

        // A hacky way to force the router to use GraphQL Hive CDN as the source of schema.
        // Our plugin does the polling and saves the supergraph to a file.
        // It also enables hot-reloading to makes sure Apollo Router watches the file.
        let file_name = config.schema_file_path.unwrap_or("supergraph-schema.graphql".to_string());
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

        match registry.initial_supergraph() {
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

        thread::spawn(move || loop {
            thread::sleep(std::time::Duration::from_secs(poll_interval));
            registry.poll()
        });

        Ok(())
    }

    fn fetch_supergraph(&mut self, etag: Option<String>) -> Result<Option<String>, String> {
        let client = reqwest::blocking::Client::builder()
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
                        self.logger.info("New supergraph detected!");
                        std::fs::write(self.file_name.clone(), new_supergraph)
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
