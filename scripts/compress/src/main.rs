extern crate flate2;

use flate2::write::GzEncoder;
use flate2::Compression;
use std::env::args;
use std::env::consts::EXE_SUFFIX;
use std::fs::File;
use std::io::copy;
use std::io::BufReader;
use std::io::BufWriter;
use std::path::Path;
use std::time::Instant;

fn main() {
    if args().len() != 3 {
        eprintln!("Usage: ./compress `source` `target`");
        return;
    }
    // let mut input = BufReader::new(File::open(args().nth(1).unwrap()).unwrap());
    // let output = File::create(args().nth(2).unwrap()).unwrap();
    // let mut encoder = GzEncoder::new(output, Compression::default());
    // let start = Instant::now();
    // copy(&mut input, &mut encoder).unwrap();
    // let output = encoder.finish().unwrap();
    // println!(
    //     "Source len: {:?}",
    //     input.get_ref().metadata().unwrap().len()
    // );
    // println!("Target len: {:?}", output.metadata().unwrap().len());
    // println!("Elapsed: {:?}", start.elapsed());

    let start = Instant::now();
    let input_path = args().nth(1).unwrap();
    let output_path = args().nth(2).unwrap();
    let cloned_input_path = input_path.clone();
    let input_filename = Path::new(&cloned_input_path)
        .file_name()
        .unwrap()
        .to_str()
        .unwrap();

    let mut input_file = File::open(input_path).expect("Failed to open the source file");

    let mut file = GzEncoder::new(
        BufWriter::new(File::create(&output_path).expect("Failed to create tgz")),
        Compression::default(),
    );
    let mut ar = tar::Builder::new(&mut file);

    ar.append_file(input_filename, &mut input_file)
        .expect("Failed to add the source file");
    ar.finish().expect("Failed to archive");
    println!("Elapsed: {:?}", start.elapsed());
}
