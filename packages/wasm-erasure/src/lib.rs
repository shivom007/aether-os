use wasm_bindgen::prelude::*;
use reed_solomon_erasure::galois_8::ReedSolomon;
/// Encodes input bytes into dynamic shards (K data + M parity).
/// Returns a flat byte array of all shards concatenated sequentially.
#[wasm_bindgen]
pub fn encode_shards(input: &[u8], data_shards: usize, parity_shards: usize) -> Vec<u8> {
    if parity_shards == 0 {
        // No redundancy needed. Just pad and split into `data_shards`.
        let shard_size = (input.len() + data_shards - 1) / data_shards;
        let padded_size = shard_size * data_shards;
        let mut padded = vec![0u8; padded_size];
        padded[..input.len()].copy_from_slice(input);
        return padded; // The flat array is just the padded input!
    }

    let rs = ReedSolomon::new(data_shards, parity_shards).expect("Failed to create RS encoder");

    // Calculate shard size (ceil division)
    let shard_size = (input.len() + data_shards - 1) / data_shards;
    let total_shards = data_shards + parity_shards;

    // Pad input to fill exactly equal-sized data shards
    let padded_size = shard_size * data_shards;
    let mut padded = vec![0u8; padded_size];
    padded[..input.len()].copy_from_slice(input);

    // Split into shard buffers
    let mut shards: Vec<Vec<u8>> = Vec::with_capacity(total_shards);
    for i in 0..data_shards {
        shards.push(padded[i * shard_size..(i + 1) * shard_size].to_vec());
    }
    for _ in 0..parity_shards {
        shards.push(vec![0u8; shard_size]);
    }

    // Compute parity shards in-place
    rs.encode(&mut shards).expect("Encoding failed");

    // Flatten all shards into a single output buffer
    let mut output = Vec::with_capacity(shard_size * total_shards);
    for shard in &shards {
        output.extend_from_slice(shard);
    }
    output
}

/// Reconstructs original data from any `data_shards` available shards.
#[wasm_bindgen]
pub fn reconstruct_shards(
    present_shards_flat: &[u8],
    present_indices: &[u8],
    original_size: usize,
    data_shards: usize,
    parity_shards: usize,
) -> Vec<u8> {
    if present_indices.len() != data_shards {
        panic!("Must provide exactly {} present shards", data_shards);
    }

    let shard_size = present_shards_flat.len() / data_shards;
    let total_shards = data_shards + parity_shards;

    if parity_shards == 0 {
        // No redundancy was used. The flat array is just the padded data chunks sequentially.
        let mut recovered = present_shards_flat.to_vec();
        recovered.truncate(original_size);
        return recovered;
    }

    let rs = ReedSolomon::new(data_shards, parity_shards).expect("Failed to create RS encoder");

    // Build the full shard array with Option<Vec<u8>>
    let mut shards: Vec<Option<Vec<u8>>> = vec![None; total_shards];

    for i in 0..data_shards {
        let idx = present_indices[i] as usize;
        let offset = i * shard_size;
        shards[idx] = Some(present_shards_flat[offset..offset + shard_size].to_vec());
    }

    // Reconstruct missing shards in-place
    rs.reconstruct(&mut shards).expect("Reconstruction failed");

    // Concatenate only the data shards
    let mut recovered = Vec::with_capacity(data_shards * shard_size);
    for i in 0..data_shards {
        recovered.extend_from_slice(
            shards[i].as_ref().expect("Data shard missing after reconstruct"),
        );
    }

    // Truncate padding back to the original size
    recovered.truncate(original_size);
    recovered
}

/// Derives a 32-byte master key from a password and salt using Argon2id.
/// `password`: UTF-8 bytes of the user's password.
/// `salt`: 16 bytes of random salt.
#[wasm_bindgen]
pub fn derive_master_key_argon2(password: &[u8], salt: &[u8]) -> Vec<u8> {
    use argon2::{
        Argon2, Params,
    };
    
    // We don't actually need PasswordHasher/SaltString if we just use Argon2 directly
    // Let's use the low-level hash_password_into to get the raw bytes
    let mut out = [0u8; 32];
    let params = Params::new(
        65536, // m_cost (memory cost): 64 MB
        3,     // t_cost (time cost): 3 iterations
        4,     // p_cost (parallelism): 4 lanes (WebAssembly is single-threaded mostly but this is fine)
        Some(32), // output length
    ).expect("Invalid Argon2 parameters");
    
    let argon2 = Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        params,
    );
    
    argon2.hash_password_into(password, salt, &mut out).expect("Argon2 derivation failed");
    out.to_vec()
}

