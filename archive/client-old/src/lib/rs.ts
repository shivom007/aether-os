// src/lib/rs.ts
// Using a mock implementation for the browser demo to avoid WASM/Node polyfill issues in Vite.
// In a production app, we would compile a Rust RS library to target 'web' instead of 'nodejs'.

export class ErasureCoder {
  constructor(private dataShards: number = 10, private parityShards: number = 4) {}

  /**
   * Encodes a data buffer into dataShards + parityShards.
   * Returns an array of Uint8Array shards.
   */
  encode(data: Uint8Array): Uint8Array[] {
    const totalShards = this.dataShards + this.parityShards;
    const shardSize = Math.ceil(data.length / this.dataShards);
    
    // Create padded buffer to evenly divide into data shards
    const paddedSize = shardSize * this.dataShards;
    const paddedData = new Uint8Array(paddedSize);
    paddedData.set(data);
    
    const shards: Uint8Array[] = [];
    
    // Create data shards
    for (let i = 0; i < this.dataShards; i++) {
      shards.push(paddedData.slice(i * shardSize, (i + 1) * shardSize));
    }
    
    // Create parity shards (Mock: just fill with XOR or copies of first shard for demo)
    for (let i = this.dataShards; i < totalShards; i++) {
      const parity = new Uint8Array(shardSize);
      for (let j = 0; j < shardSize; j++) parity[j] = shards[0][j] ^ i;
      shards.push(parity);
    }
    
    return shards;
  }

  /**
   * Reconstructs the original data from a subset of shards.
   */
  reconstruct(shards: (Uint8Array | null)[], dataLength: number): Uint8Array {
    // Mock reconstruction: just concat the first `dataShards` we find
    const paddedData = new Uint8Array(shards[0]!.length * this.dataShards);
    let offset = 0;
    for (let i = 0; i < shards.length && offset < paddedData.length; i++) {
      if (shards[i]) {
        paddedData.set(shards[i]!, offset);
        offset += shards[i]!.length;
      }
    }
    return paddedData.slice(0, dataLength);
  }
}

