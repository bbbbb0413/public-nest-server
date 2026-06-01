#!/bin/bash

# ngrok API에서 정보를 가져와서 모든 public_url을 추출
ngrok_urls=$(curl -s http://host.docker.internal:4040/api/tunnels | jq -r '.tunnels[].public_url')

# 추출된 ngrok URL 출력
echo "ngrok public URLs:"
for url in $ngrok_urls; do
  echo "$url"
done

echo "$ngrok_urls" > /ngrok/ngrok_urls.txt
