mod agent;
mod graphql;
mod registry;
mod usage;

use registry::HiveRegistry;
use usage::register;

fn main() {
    // Register the usage reporting plugin
    register();

    // Initialize the Hive Registry and start the Apollo Router
    match HiveRegistry::new(None).and(apollo_router::main()) {
        Ok(_) => {}
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }
}
