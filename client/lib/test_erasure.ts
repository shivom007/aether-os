import { encodeShards, reconstructShards, DATA_SHARDS, TOTAL_SHARDS } from "./erasure";

async function runTest() {
  const originalData = new Uint8Array(100);
  for (let i = 0; i < 100; i++) originalData[i] = Math.floor(Math.random() * 256);

  console.log("Encoding shards...");
  const encoded = await encodeShards(originalData);

  console.log("Encoded", encoded.shards.length, "shards.");

  // Simulate loss of 4 data shards (shards 0, 2, 5, 8)
  const availableShards: (Uint8Array | null)[] = [...encoded.shards];
  availableShards[0] = null;
  availableShards[2] = null;
  availableShards[5] = null;
  availableShards[8] = null;

  console.log("Reconstructing from available shards...");
  try {
    const recovered = await reconstructShards(availableShards, originalData.length);
    
    let match = true;
    for (let i = 0; i < originalData.length; i++) {
      if (recovered[i] !== originalData[i]) {
        match = false;
        console.error(`Mismatch at byte ${i}: expected ${originalData[i]}, got ${recovered[i]}`);
        break;
      }
    }

    if (match) {
      console.log("SUCCESS! All data recovered perfectly.");
    } else {
      console.error("FAILED! Recovered data does not match original.");
    }
  } catch (e) {
    console.error("Error during reconstruction:", e);
  }
}

runTest();
