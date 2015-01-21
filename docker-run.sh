#!/bin/bash

set -e

exec yomypopcorn-scanner \
	--debug \
	--redis-host ${REDIS_PORT_6379_TCP_ADDR} \
	--redis-port ${REDIS_PORT_6379_TCP_PORT} \
	--full-scan
