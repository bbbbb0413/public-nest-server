#!/bin/bash
set -e

# MySQL 데몬 백그라운드 실행
docker-entrypoint.sh mysqld &

# MySQL 서버가 올라올 때까지 대기
until mysqladmin ping -h 127.0.0.1 --silent; do
  echo "Waiting for MySQL to be available..."
  sleep 1
done

# 여러 데이터베이스 생성 쿼리 실행
mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<EOSQL
CREATE DATABASE IF NOT EXISTS \`personal\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS \`game\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS \`payment\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'admin'@'%' IDENTIFIED BY '${DB_USER_PW}';
GRANT ALL PRIVILEGES ON *.* TO 'admin'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EOSQL

# MySQL 프로세스 포그라운드로 전환하여 컨테이너 유지
wait
