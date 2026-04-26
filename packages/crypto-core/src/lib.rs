//! Aether crypto-core exports (consolidated scaffold).

pub mod pipeline {
    /// Placeholder pipeline API until full WASM implementation is added.
    pub fn version() -> &'static str {
        "0.1.0-scaffold"
    }
}

pub mod sharing {
    /// Placeholder sharing API for phase-consolidated export surface.
    pub fn enabled() -> bool {
        true
    }
}

pub use pipeline::version as pipeline_version;
