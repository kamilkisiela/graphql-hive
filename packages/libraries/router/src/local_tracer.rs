use tracing;
use tracing_subscriber::{
    fmt::{
        self,
        format::{DefaultFields, Format},
    },
    EnvFilter,
};

pub struct LocalTracer {}

impl LocalTracer {
    fn get_subscriber() -> fmt::Subscriber<DefaultFields, Format, EnvFilter> {
        let subscriber = fmt::Subscriber::builder()
            .with_env_filter(EnvFilter::from_default_env())
            .finish();

        subscriber
    }
    pub fn debug(message: &str) {
        tracing::subscriber::with_default(Self::get_subscriber(), || tracing::debug!(message));
    }
    pub fn info(message: &str) {
        tracing::subscriber::with_default(Self::get_subscriber(), || tracing::info!(message));
    }
    pub fn warn(message: &str) {
        tracing::subscriber::with_default(Self::get_subscriber(), || tracing::warn!(message));
    }
    pub fn trace(message: &str) {
        tracing::subscriber::with_default(Self::get_subscriber(), || tracing::trace!(message));
    }
    fn error(message: &str) {
        tracing::subscriber::with_default(Self::get_subscriber(), || tracing::error!(message));
    }
}
