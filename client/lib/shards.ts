export interface ShardAllocation {
  shardId: number
  shardIndex: number
  provider: string
}

export interface ChunkAllocationResponse {
  job_id: string
  status: "allocated"
  allocation: {
    chunkId: number
    allocations: ShardAllocation[]
  }
}
