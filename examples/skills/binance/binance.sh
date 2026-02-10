#!/bin/bash
#
# Binance Trading Skill
# Simple shell script - no dependencies, no state, no npm
#

set -e

# Get env vars (from onboarding or provided)
API_KEY="${BINANCE_API_KEY}"
API_SECRET="${BINANCE_API_SECRET}"
USE_TESTNET="${BINANCE_TESTNET:-true}"

# Select endpoint
if [[ "$USE_TESTNET" == "true" ]]; then
    BASE_URL="https://testnet.binance.vision"
else
    BASE_URL="https://api.binance.com"
fi

# Generate HMAC-SHA256 signature
generate_signature() {
    local query="$1"
    echo -n "$query" | openssl dgst -sha256 -hmac "$API_SECRET" | sed 's/^.* //'
}

# Make authenticated request
api_call() {
    local endpoint="$1"
    local method="${2:-GET}"
    local params="${3:-}"
    
    local timestamp
    timestamp=$(date +%s)000
    
    local query="timestamp=$timestamp"
    [[ -n "$params" ]] && query="$query&$params"
    
    local sig
    sig=$(generate_signature "$query")
    
    local url="$BASE_URL$endpoint?$query&signature=$sig"
    
    if [[ "$method" == "POST" ]]; then
        curl -s -H "X-MBX-APIKEY: $API_KEY" -X POST "$url"
    else
        curl -s -H "X-MBX-APIKEY: $API_KEY" "$url"
    fi
}

# Commands
cmd_balance() {
    local asset="${1^^}"
    
    if [[ -z "$asset" ]]; then
        echo '{"error":"Asset required"}' >&2
        exit 1
    fi
    
    local response
    response=$(api_call "/api/v3/account")
    
    echo "$response" | jq -r --arg asset "$asset" '.balances[] | select(.asset == $asset) // {"asset":$asset,"free":"0","locked":"0"}'
}

cmd_ticker() {
    local symbol="${1^^}"
    
    if [[ -z "$symbol" ]]; then
        echo '{"error":"Symbol required (e.g., BTCUSDT)"}' >&2
        exit 1
    fi
    
    curl -s "$BASE_URL/api/v3/ticker/price?symbol=$symbol"
}

cmd_buy() {
    local symbol="${1^^}"
    local qty="$2"
    
    if [[ -z "$symbol" || -z "$qty" ]]; then
        echo '{"error":"Usage: buy <symbol> <quantity>"}' >&2
        exit 1
    fi
    
    if [[ "$USE_TESTNET" != "true" ]]; then
        echo '{"warning":"LIVE TRADING - Using real funds!"}' >&2
    fi
    
    local params="symbol=$symbol&side=BUY&type=MARKET&quantity=$qty"
    api_call "/api/v3/order" "POST" "$params"
}

cmd_sell() {
    local symbol="${1^^}"
    local qty="$2"
    
    if [[ -z "$symbol" || -z "$qty" ]]; then
        echo '{"error":"Usage: sell <symbol> <quantity>"}' >&2
        exit 1
    fi
    
    if [[ "$USE_TESTNET" != "true" ]]; then
        echo '{"warning":"LIVE TRADING - Using real funds!"}' >&2
    fi
    
    local params="symbol=$symbol&side=SELL&type=MARKET&quantity=$qty"
    api_call "/api/v3/order" "POST" "$params"
}

cmd_help() {
    cat <<EOF
Binance Skill

Usage: binance.sh <command> [args...]

Commands:
  balance <asset>          Get balance for asset (e.g., BTC)
  ticker <symbol>          Get price for symbol (e.g., BTCUSDT)
  buy <symbol> <qty>       Place market buy order
  sell <symbol> <qty>      Place market sell order
  help                     Show this help

Environment:
  BINANCE_API_KEY          Required - API key
  BINANCE_API_SECRET       Required - API secret  
  BINANCE_TESTNET          Optional - "true" for testnet (default: true)

Examples:
  BINANCE_API_KEY=xxx BINANCE_API_SECRET=yyy ./binance.sh balance BTC
  ./binance.sh ticker BTCUSDT
EOF
}

# Main
main() {
    # Validate API credentials
    if [[ -z "$API_KEY" || -z "$API_SECRET" ]]; then
        echo '{"error":"BINANCE_API_KEY and BINANCE_API_SECRET required"}' >&2
        exit 1
    fi
    
    local cmd="${1:-help}"
    shift || true
    
    case "$cmd" in
        balance)
            cmd_balance "$@"
            ;;
        ticker)
            cmd_ticker "$@"
            ;;
        buy)
            cmd_buy "$@"
            ;;
        sell)
            cmd_sell "$@"
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            echo "{\"error\":\"Unknown command: $cmd\"}" >&2
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
