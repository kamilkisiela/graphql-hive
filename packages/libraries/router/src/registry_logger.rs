use std::{env, fmt};

static LOG_LEVEL_NAMES: [&str; 5] = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"];

#[repr(usize)]
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Debug)]
pub enum Level {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

impl Level {
    fn from_usize(u: usize) -> Option<Level> {
        match u {
            0 => Some(Level::Error),
            1 => Some(Level::Warn),
            2 => Some(Level::Info),
            3 => Some(Level::Debug),
            4 => Some(Level::Trace),
            _ => None,
        }
    }

    fn from_str(s: &str) -> Level {
        LOG_LEVEL_NAMES
            .iter()
            .position(|&name| name.eq_ignore_ascii_case(s))
            .map(|p| Level::from_usize(p).expect("Hive failed to read the log level"))
            .expect("Hive failed to parse the log level filter")
    }

    pub fn as_str(&self) -> &'static str {
        LOG_LEVEL_NAMES[*self as usize]
    }
}

impl fmt::Display for Level {
    fn fmt(&self, fmt: &mut fmt::Formatter) -> fmt::Result {
        fmt.pad(self.as_str())
    }
}

#[derive(Clone, Debug)]
pub struct Logger {
    max_level: Level,
}

impl Logger {
    pub fn new() -> Logger {
        Self {
            max_level: Level::from_str(
                env::var("HIVE_REGISTRY_LOG")
                    .unwrap_or_else(|_| "info".to_string())
                    .as_str(),
            ),
        }
    }

    fn should_log(&self, level: Level) -> bool {
        self.max_level >= level
    }

    #[allow(dead_code)]
    pub fn trace(&self, message: &str) {
        if self.should_log(Level::Trace) {
            println!("TRACE: {}", message);
        }
    }

    #[allow(dead_code)]
    pub fn debug(&self, message: &str) {
        if self.should_log(Level::Debug) {
            println!("DEBUG: {}", message);
        }
    }

    pub fn info(&self, message: &str) {
        if self.should_log(Level::Info) {
            println!("INFO: {}", message);
        }
    }

    #[allow(dead_code)]
    pub fn warn(&self, message: &str) {
        if self.should_log(Level::Warn) {
            println!("WARNING: {}", message);
        }
    }

    pub fn error(&self, message: &str) {
        if self.should_log(Level::Error) {
            println!("ERROR: {}", message);
        }
    }
}
