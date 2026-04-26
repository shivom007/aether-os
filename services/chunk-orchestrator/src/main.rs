mod interface;

use interface::grpc::chunk_service_impl::ChunkOrchestratorServiceImpl;

fn main() {
    let _svc = ChunkOrchestratorServiceImpl::new();
    println!("chunk-orchestrator scaffold initialized");
}
