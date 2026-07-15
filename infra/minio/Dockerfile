FROM minio/minio:latest
# Railway will automatically pass the PORT variable. 
# We need to map MinIO's console or API port to what Railway expects, or configure Railway to expose 9000.
# MinIO S3 API usually runs on 9000, console on 9001. 
# Railway exposes a single port per service on the public domain, but handles custom ports via the CLI.
# The simplest approach is to let MinIO run as usual and configure Railway domains.
ENTRYPOINT ["minio", "server", "/data", "--console-address", ":9001"]
