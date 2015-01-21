#!/bin/bash

set -e

echo ${REDIS_PORT_6379_TCP_ADDR}
echo ${REDIS_PORT_6379_TCP_PORT}

yomypopcorn-scanner \
	--debug \
	--redis-host ${REDIS_PORT_6379_TCP_ADDR} \
	--redis-port ${REDIS_PORT_6379_TCP_PORT} \
