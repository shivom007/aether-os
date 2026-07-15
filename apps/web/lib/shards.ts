export interface ShardAllocation {
  shardId: number
  shardIndex: number
  provider: string
}

export interface ChunkAllocationResponse {
  allocation: {
    dataShards: number
    parityShards: number
    allocations: ShardAllocation[]
  }
}
