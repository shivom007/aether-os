/* tslint:disable */
/* eslint-disable */

/**
 * Derives a 32-byte master key from a password and salt using Argon2id.
 * `password`: UTF-8 bytes of the user's password.
 * `salt`: 16 bytes of random salt.
 */
export function derive_master_key_argon2(password: Uint8Array, salt: Uint8Array): Uint8Array;

/**
 * Encodes input bytes into 14 shards (10 data + 4 parity).
 * Returns a flat byte array of all shards concatenated sequentially.
 */
export function encode_shards(input: Uint8Array): Uint8Array;

/**
 * Reconstructs original data from any 10 available shards.
 * `present_shards_flat`: flat byte array of the 10 available shards concatenated.
 * `present_indices`: byte array of the 10 shard indices (0-13).
 * `original_size`: the original unpadded data length.
 */
export function reconstruct_shards(present_shards_flat: Uint8Array, present_indices: Uint8Array, original_size: number): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly derive_master_key_argon2: (a: number, b: number, c: number, d: number) => [number, number];
    readonly encode_shards: (a: number, b: number) => [number, number];
    readonly reconstruct_shards: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
