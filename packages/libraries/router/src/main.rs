mod agent;
mod graphql;
mod registry;
mod usage;

use registry::HiveRegistry;
use usage::register;

fn main() {
    register();

    match HiveRegistry::new(None) {
        Ok(_) => {}
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }

    match apollo_router::main() {
        Ok(_) => {}
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }
}
