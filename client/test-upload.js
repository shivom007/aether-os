const http = require("http")

async function testUpload() {
  const size = 80 * 1024 * 1024 // 80 MB
  const body = Buffer.alloc(size)
  console.log("Sending", body.length, "bytes")
  
  const res = await fetch("http://localhost:3000/api/jobs/chunk", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Aether-Inode-Id": "test",
      "X-Aether-Version-Id": "1",
      "X-Aether-Chunk-Index": "0",
    },
    body: body,
  })
  
  console.log("Status:", res.status)
  console.log("Text:", await res.text())
}

testUpload().catch(console.error)
