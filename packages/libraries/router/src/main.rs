// Specify the modules our binary should include -- https://twitter.com/YassinEldeeb7/status/1468680104243077128
mod agent;
mod graphql;
mod registry;
mod registry_logger;
mod usage;

use registry::HiveRegistry;
use tokio::runtime::Runtime;
use usage::register;

fn main() {
    // Register the usage reporting plugin
    register();

    // Create a new Tokio runtime for the HiveRegistry initialization
    let hive_runtime = Runtime::new().unwrap();

    let result = hive_runtime.block_on(HiveRegistry::new(None));

    match result {
        Ok(_) => {
            if let Err(e) = apollo_router::main() {
                eprintln!("{}", e);
                std::process::exit(1);
            }
        }
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }
}
