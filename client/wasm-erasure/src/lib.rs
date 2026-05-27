use wasm_bindgen::prelude::*;
use reed_solomon_erasure::galois_8::ReedSolomon;
use std::sync::OnceLock;

const DATA_SHARDS: usize = 10;
const PARITY_SHARDS: usize = 4;
const TOTAL_SHARDS: usize = DATA_SHARDS + PARITY_SHARDS;

static RS_ENCODER: OnceLock<ReedSolomon> = OnceLock::new();

fn get_encoder() -> &'static ReedSolomon {
    RS_ENCODER.get_or_init(|| {
        ReedSolomon::new(DATA_SHARDS, PARITY_SHARDS)
            .expect("Failed to create ReedSolomon encoder")
    })
}

/// Encodes input bytes into 14 shards (10 data + 4 parity).
/// Returns a flat byte array of all shards concatenated sequentially.
#[wasm_bindgen]
pub fn encode_shards(input: &[u8]) -> Vec<u8> {
    let rs = get_encoder();

    // Calculate shard size (ceil division)
    let shard_size = (input.len() + DATA_SHARDS - 1) / DATA_SHARDS;

    // Pad input to fill exactly 10 equal-sized data shards
    let padded_size = shard_size * DATA_SHARDS;
    let mut padded = vec![0u8; padded_size];
    padded[..input.len()].copy_from_slice(input);

    // Split into 14 shard buffers (10 data filled, 4 parity zeroed)
    let mut shards: Vec<Vec<u8>> = Vec::with_capacity(TOTAL_SHARDS);
    for i in 0..DATA_SHARDS {
        shards.push(padded[i * shard_size..(i + 1) * shard_size].to_vec());
    }
    for _ in 0..PARITY_SHARDS {
        shards.push(vec![0u8; shard_size]);
    }

    // Let the crate compute parity shards in-place
    rs.encode(&mut shards).expect("Encoding failed");

    // Flatten all 14 shards into a single output buffer
    let mut output = Vec::with_capacity(shard_size * TOTAL_SHARDS);
    for shard in &shards {
        output.extend_from_slice(shard);
    }
    output
}

/// Reconstructs original data from any 10 available shards.
/// `present_shards_flat`: flat byte array of the 10 available shards concatenated.
/// `present_indices`: byte array of the 10 shard indices (0-13).
/// `original_size`: the original unpadded data length.
#[wasm_bindgen]
pub fn reconstruct_shards(
    present_shards_flat: &[u8],
    present_indices: &[u8],
    original_size: usize,
) -> Vec<u8> {
    if present_indices.len() != DATA_SHARDS {
        panic!("Must provide exactly {} present shards", DATA_SHARDS);
    }

    let rs = get_encoder();
    let shard_size = present_shards_flat.len() / DATA_SHARDS;

    // Build the full 14-slot shard array with Option<Vec<u8>>
    // Present shards get Some(...), missing shards get None
    let mut shards: Vec<Option<Vec<u8>>> = vec![None; TOTAL_SHARDS];

    for i in 0..DATA_SHARDS {
        let idx = present_indices[i] as usize;
        let offset = i * shard_size;
        shards[idx] = Some(present_shards_flat[offset..offset + shard_size].to_vec());
    }

    // The crate reconstructs missing shards in-place
    rs.reconstruct(&mut shards).expect("Reconstruction failed");

    // Concatenate only the first 10 (data) shards
    let mut recovered = Vec::with_capacity(DATA_SHARDS * shard_size);
    for i in 0..DATA_SHARDS {
        recovered.extend_from_slice(
            shards[i].as_ref().expect("Data shard still missing after reconstruct"),
        );
    }

    // Truncate padding back to the original size
    recovered.truncate(original_size);
    recovered
}
