#!/usr/bin/env bash

export SRC_DIR=$(cd "$(dirname "$0")"; pwd)

$SRC_DIR/__AUTO_UPDATE_BUNDLE__/exo_browser/exo_browser         \
  --raw $SRC_DIR/__AUTO_UPDATE_BUNDLE__/breach_core
