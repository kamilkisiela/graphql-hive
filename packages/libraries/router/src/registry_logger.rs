use std::{env, fmt};

static LOG_LEVEL_NAMES: [&str; 5] = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"];

#[repr(usize)]
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Debug)]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

impl LogLevel {
    fn from_usize(u: usize) -> Option<LogLevel> {
        match u {
            0 => Some(LogLevel::Error),
            1 => Some(LogLevel::Warn),
            2 => Some(LogLevel::Info),
            3 => Some(LogLevel::Debug),
            4 => Some(LogLevel::Trace),
            _ => None,
        }
    }

    fn from_str(s: &str) -> LogLevel {
        LOG_LEVEL_NAMES
            .iter()
            .position(|&name| name.eq_ignore_ascii_case(s))
            .map(|p| LogLevel::from_usize(p).expect("Hive failed to read the log level"))
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
    max_level: LogLevel,
}

impl Logger {
    pub fn new() -> Logger {
        Self {
            max_level: LogLevel::from_str(
                env::var("HIVE_REGISTRY_LOG")
                    .unwrap_or_else(|_| "info".to_string())
                    .as_str(),
            ),
        }
    }

    fn should_log(&self, level: LogLevel) -> bool {
        self.max_level >= level
    }

    #[allow(dead_code)]
    pub fn trace(&self, message: &str) {
        if self.should_log(LogLevel::Trace) {
            println!("TRACE: {}", message);
        }
    }

    #[allow(dead_code)]
    pub fn debug(&self, message: &str) {
        if self.should_log(LogLevel::Debug) {
            println!("DEBUG: {}", message);
        }
    }

    pub fn info(&self, message: &str) {
        if self.should_log(LogLevel::Info) {
            println!("INFO: {}", message);
        }
    }

    #[allow(dead_code)]
    pub fn warn(&self, message: &str) {
        if self.should_log(LogLevel::Warn) {
            println!("WARNING: {}", message);
        }
    }

    pub fn error(&self, message: &str) {
        if self.should_log(LogLevel::Error) {
            println!("ERROR: {}", message);
        }
    }
}
