#!/usr/bin/env python3
"""
Cache-Busting Script for renderer.bundle.js.txt
Adds a timestamp comment at the beginning to force new Metro hash
"""

import time
import sys

def add_cache_bust(input_file, output_file):
    """Add timestamp comment to beginning of file"""
    timestamp = int(time.time())
    cache_bust_comment = f"/* BUILD_VERSION: {timestamp} */\n"

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(cache_bust_comment)
            f.write(content)

        print(f"✓ Cache-bust added: {timestamp}")
        print(f"  Input:  {input_file}")
        print(f"  Output: {output_file}")
        return True

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: cache-bust.py <input_file> <output_file>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    success = add_cache_bust(input_file, output_file)
    sys.exit(0 if success else 1)

