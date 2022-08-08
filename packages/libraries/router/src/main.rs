use registry::HiveRegistry;

mod agent;
mod graphql;
mod registry;
mod usage;

fn main() {
    match HiveRegistry::new() {
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
