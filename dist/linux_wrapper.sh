#!/bin/sh

export SRC_DIR=$(cd "$(dirname "$0")"; pwd)

AUTO_UPDATE=true $SRC_DIR/exo_browser/exo_browser --raw $SRC_DIR/breach_core --expose-gc
