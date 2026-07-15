use jni::JNIEnv;
use jni::objects::{JClass, JByteArray};
use jni::sys::jbyteArray;
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

#[no_mangle]
pub extern "system" fn Java_com_aetheros_crypto_ErasureEngine_encodeShards<'local>(
    env: JNIEnv<'local>,
    _class: JClass<'local>,
    input_array: JByteArray<'local>,
) -> jbyteArray {
    let input = env.convert_byte_array(&input_array).expect("Failed to read byte array");
    let rs = get_encoder();

    let shard_size = (input.len() + DATA_SHARDS - 1) / DATA_SHARDS;
    let padded_size = shard_size * DATA_SHARDS;
    let mut padded = vec![0u8; padded_size];
    padded[..input.len()].copy_from_slice(&input);

    let mut shards: Vec<Vec<u8>> = Vec::with_capacity(TOTAL_SHARDS);
    for i in 0..DATA_SHARDS {
        shards.push(padded[i * shard_size..(i + 1) * shard_size].to_vec());
    }
    for _ in 0..PARITY_SHARDS {
        shards.push(vec![0u8; shard_size]);
    }

    rs.encode(&mut shards).expect("Encoding failed");

    let mut output = Vec::with_capacity(shard_size * TOTAL_SHARDS);
    for shard in &shards {
        output.extend_from_slice(shard);
    }

    let output_array = env.byte_array_from_slice(&output).expect("Failed to create byte array");
    output_array.into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_aetheros_crypto_ErasureEngine_reconstructShards<'local>(
    env: JNIEnv<'local>,
    _class: JClass<'local>,
    present_shards_flat_array: JByteArray<'local>,
    present_indices_array: JByteArray<'local>,
    original_size: jni::sys::jint,
) -> jbyteArray {
    let present_shards_flat = env.convert_byte_array(&present_shards_flat_array).expect("Failed to read flat shards");
    let present_indices = env.convert_byte_array(&present_indices_array).expect("Failed to read indices");
    
    if present_indices.len() != DATA_SHARDS {
        panic!("Must provide exactly {} present shards", DATA_SHARDS);
    }

    let rs = get_encoder();
    let shard_size = present_shards_flat.len() / DATA_SHARDS;

    let mut shards: Vec<Option<Vec<u8>>> = vec![None; TOTAL_SHARDS];

    for i in 0..DATA_SHARDS {
        let idx = present_indices[i] as usize;
        let offset = i * shard_size;
        shards[idx] = Some(present_shards_flat[offset..offset + shard_size].to_vec());
    }

    rs.reconstruct(&mut shards).expect("Reconstruction failed");

    let mut recovered = Vec::with_capacity(DATA_SHARDS * shard_size);
    for i in 0..DATA_SHARDS {
        recovered.extend_from_slice(
            shards[i].as_ref().expect("Data shard still missing after reconstruct"),
        );
    }

    recovered.truncate(original_size as usize);
    let output_array = env.byte_array_from_slice(&recovered).expect("Failed to create byte array");
    output_array.into_raw()
}


#[no_mangle]
pub extern "system" fn Java_com_aetheros_crypto_ErasureEngine_deriveMasterKeyArgon2<'local>(
    env: JNIEnv<'local>,
    _class: JClass<'local>,
    password_array: JByteArray<'local>,
    salt_array: JByteArray<'local>,
) -> jbyteArray {
    use argon2::{Argon2, Params};
    
    let password = env.convert_byte_array(&password_array).expect("Failed to read password");
    let salt = env.convert_byte_array(&salt_array).expect("Failed to read salt");

    let mut out = [0u8; 32];
    let params = Params::new(65536, 3, 4, Some(32)).expect("Invalid Argon2 parameters");
    
    let argon2 = Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        params,
    );
    
    argon2.hash_password_into(&password, &salt, &mut out).expect("Argon2 derivation failed");
    
    let output_array = env.byte_array_from_slice(&out).expect("Failed to create output array");
    output_array.into_raw()
}
