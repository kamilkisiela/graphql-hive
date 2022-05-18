#!/bin/sh

set -e

npm install -g file:stripe-billing.tgz
stripe-billing
